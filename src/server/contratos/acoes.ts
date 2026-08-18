'use server'

import { revalidatePath } from 'next/cache'
import { clienteServidor, exigirConta } from '../conta'
import { registrar } from '../log'
import { hojeEm } from '../agenda/fuso'
import { temVinculo } from './consultas'
import { precoAplicado, type Recorrencia } from '@/core/planos/plano'
import { fimDoContrato, fimProrrogado } from '@/core/contratos/contrato'
import { DIAS_INTEIROS } from '@/core/agenda/datas'

/**
 * O contrato.
 *
 * Erro volta como **valor**: o Next não deixa a mensagem de uma exceção
 * atravessar a Server Action, e quem precisa da frase ("a horário de segunda já
 * está cheia") é justamente quem pode escolher outra.
 */
export type Resultado<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { valor: T }))
  | { ok: false; erro: string }

export type NovoContrato = {
  pessoaId: string
  planoId: string
  /** as horários que a pessoa vai ocupar; o plano diz quantas são */
  serieIds: string[]
  inicio: string
  diaVencimento: number | null
  formaPagamento: string | null
}

async function exigirOperacional() {
  const conta = await exigirConta()
  if (conta.papel !== 'dono' && conta.papel !== 'recepcao' && conta.papel !== 'suporte') {
    throw new Error('quem matricula é a recepção ou quem responde pelo negócio')
  }
  return conta
}

/**
 * Matricular, e ocupar os horários escolhidos.
 *
 * As vagas são conferidas **todas antes de gravar qualquer uma**. Uma contrato
 * de duas horários em que a segunda está cheia não pode deixar a pessoa dentro da
 * primeira e um erro na tela: ela sairia de lá achando que resolveu, e a
 * chamada de quarta apareceria sem ela.
 */
export async function criarContrato(
  novo: NovoContrato,
): Promise<Resultado<string>> {
  try {
    const conta = await exigirOperacional()
    const db = await clienteServidor()
    const hoje = hojeEm(conta.fuso)

    const { data: plano } = await db.from('plano')
      .select('id, nome, servico_id, recorrencia, frequencia_semanal, sessoes_no_pacote, validade_meses, preco_vinculado_cent, preco_avulso_cent, ativo')
      .eq('id', novo.planoId).eq('conta_id', conta.contaId)
      .maybeSingle()
    if (!plano) return { ok: false, erro: 'Esse plano não existe mais nesta conta.' }
    if (!plano.ativo) {
      return { ok: false, erro: `O plano ${plano.nome} saiu de uso. Escolha outro, ou volte a usá-lo em Configuração.` }
    }

    const pedidas = [...new Set(novo.serieIds)].filter(Boolean)
    const exigidas = plano.frequencia_semanal ?? 0
    if (exigidas && pedidas.length !== exigidas) {
      return {
        ok: false,
        erro: `Este plano pede ${exigidas} ${exigidas === 1 ? 'horário' : 'horários'}, e ${pedidas.length} ${pedidas.length === 1 ? 'foi escolhido' : 'foram escolhidos'}.`,
      }
    }

    const recusa = await conferirVagas(db, conta.contaId, novo.pessoaId, pedidas, hoje)
    if (recusa) return { ok: false, erro: recusa }

    const vinculo = await temVinculo(
      db, conta.contaId, novo.pessoaId, plano.servico_id, hoje)
    const preco = precoAplicado({
      precoVinculadoCent: plano.preco_vinculado_cent,
      precoAvulsoCent: plano.preco_avulso_cent,
    }, vinculo)

    const fim = fimDoContrato(novo.inicio, {
      recorrencia: plano.recorrencia as Recorrencia,
      validadeMeses: plano.validade_meses,
    })

    const { data: { user } } = await db.auth.getUser()
    const { data: contrato, error } = await db.from('contrato').insert({
      conta_id: conta.contaId,
      pessoa_id: novo.pessoaId,
      plano_id: plano.id,
      inicio: novo.inicio,
      fim,
      dia_vencimento: novo.diaVencimento,
      preco_aplicado_cent: preco.cent,
      vinculo_usado: preco.vinculo,
      forma_pagamento: novo.formaPagamento,
      sessoes_contratadas: plano.sessoes_no_pacote,
      criado_por_usuario_id: user?.id ?? null,
    }).select('id').single<{ id: string }>()
    if (error) throw error

    if (pedidas.length) {
      const { error: erroVaga } = await db.from('vaga').insert(pedidas.map((serieId) => ({
        conta_id: conta.contaId,
        serie_id: serieId,
        pessoa_id: novo.pessoaId,
        inicio: novo.inicio,
        contrato_id: contrato.id,
      })))
      if (erroVaga) {
        // sem transação entre as duas escritas, contrato sem as vagas dele é
        // pior que nenhum: ele contaria como contrato e ninguém apareceria na
        // chamada
        await db.from('contrato').delete().eq('id', contrato.id)
        throw erroVaga
      }
    }

    await escreverVencimentoNaFicha(db, conta.contaId, novo.pessoaId)

    await registrar(db, {
      contaId: conta.contaId, entidade: 'contrato', entidadeId: contrato.id,
      acao: 'criou',
      detalhe: { plano: plano.nome, precoCent: preco.cent, vinculo: preco.vinculo },
    })

    revalidatePath(`/pessoas/${novo.pessoaId}`)
    revalidatePath('/grade')
    revalidatePath('/semana')
    return { ok: true, valor: contrato.id }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Não foi possível matricular.' }
  }
}

/**
 * As horários cabem, e a pessoa já não está nelas?
 *
 * Devolve a frase da recusa, ou `null` quando tudo passa. A conferência é de
 * todas antes de gravar qualquer uma.
 */
async function conferirVagas(
  db: Awaited<ReturnType<typeof clienteServidor>>,
  contaId: string, pessoaId: string, serieIds: string[], hoje: string,
  /*
   * Ao retomar uma licença, as vagas do próprio contrato ainda estão lá, com
   * data de fim: sem ignorá-las, o sistema recusaria devolver o lugar de
   * alguém dizendo que ela já o ocupa.
   */
  ignorarContrato?: string,
): Promise<string | null> {
  if (!serieIds.length) return null

  const { data: series } = await db.from('serie')
    .select('id, dia_semana, hora_inicio, capacidade, codigo, vaga(pessoa_id, inicio, fim, contrato_id)')
    .eq('conta_id', contaId).in('id', serieIds)

  if (!series || series.length !== serieIds.length) {
    return 'Um dos horários escolhidos não existe mais.'
  }

  for (const s of series) {
    const nome = `${DIAS_INTEIROS[s.dia_semana]} às ${String(s.hora_inicio).slice(0, 5)}`
    // viva é a que ainda não terminou, inclusive a que começa mais para a
    // frente: o lugar de quem entra em setembro já está ocupado hoje
    const vivas = (s.vaga ?? [])
      .filter((v) => v.contrato_id !== ignorarContrato)
      .filter((v) => v.fim === null || v.fim >= hoje)

    if (vivas.some((v) => v.pessoa_id === pessoaId)) {
      return `Esta pessoa já ocupa o horário de ${nome}.`
    }
    if (vivas.length >= s.capacidade) {
      return `O horário de ${nome} está cheio: ${vivas.length} de ${s.capacidade}.`
    }
  }
  return null
}

/**
 * A ficha continua mostrando um vencimento, e ele passa a vir do contrato.
 *
 * A coluna é lida em seis lugares, um deles o filtro "plano vencendo" da lista
 * de pessoas, que a lê dentro de `pessoa_resumo`. Derivar tudo em tempo de
 * leitura obrigaria a mexer na view e a refazer o filtro; escrever aqui mantém
 * as duas coisas funcionando e o número certo.
 */
async function escreverVencimentoNaFicha(
  db: Awaited<ReturnType<typeof clienteServidor>>,
  contaId: string, pessoaId: string,
): Promise<void> {
  const { data } = await db.from('contrato')
    .select('fim, pausa(inicio, fim)')
    .eq('conta_id', contaId).eq('pessoa_id', pessoaId)
    .neq('status', 'encerrado')

  const fins = (data ?? [])
    .map((c) => fimProrrogado(c.fim, (c.pausa ?? []).map((p) => ({
      inicio: p.inicio, fim: p.fim,
    }))))
    .filter((f): f is string => f !== null)
    .sort()

  // o mais próximo é o que a ficha precisa mostrar: é ele que vence primeiro
  await db.from('pessoa')
    .update({ vencimento_plano: fins[0] ?? null })
    .eq('id', pessoaId).eq('conta_id', contaId)
}

/** Trancar: as vagas fecham, e o fim vai andar quando a pessoa voltar. */
export async function trancarContrato(
  contratoId: string, inicio: string, motivo: string | null,
): Promise<Resultado> {
  try {
    const conta = await exigirOperacional()
    const db = await clienteServidor()

    const { data: c } = await db.from('contrato')
      .select('id, pessoa_id, status').eq('id', contratoId)
      .eq('conta_id', conta.contaId).maybeSingle()
    if (!c) return { ok: false, erro: 'Contrato não encontrado.' }
    if (c.status !== 'ativo') {
      return { ok: false, erro: 'Só dá para trancar um contrato que está em vigor.' }
    }

    const { error } = await db.from('pausa').insert({
      conta_id: conta.contaId, contrato_id: contratoId, inicio, motivo,
    })
    if (error) throw error

    await db.from('contrato').update({ status: 'pausado' }).eq('id', contratoId)
    // a vaga fecha no dia em que a pausa começa: o lugar volta para a horário, e
    // quem está na fila de espera pode ocupá-lo enquanto isso
    await db.from('vaga').update({ fim: inicio })
      .eq('contrato_id', contratoId).is('fim', null)

    await registrar(db, {
      contaId: conta.contaId, entidade: 'contrato', entidadeId: contratoId,
      acao: 'encerrou', detalhe: { pausa: inicio, motivo },
    })

    revalidatePath(`/pessoas/${c.pessoa_id}`)
    return { ok: true }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Não foi possível trancar.' }
  }
}

/**
 * Retomar: a pausa fecha, o fim anda pelos dias parados, e as horários voltam.
 *
 * As vagas são criadas de novo, e não reabertas: a vaga velha registra o
 * período em que a pessoa esteve na sala, e reabri-la apagaria o fato de que
 * ela ficou fora durante a licença.
 */
export async function retomarContrato(
  contratoId: string, volta: string,
): Promise<Resultado> {
  try {
    const conta = await exigirOperacional()
    const db = await clienteServidor()
    const hoje = hojeEm(conta.fuso)

    const { data: c } = await db.from('contrato')
      .select('id, pessoa_id, status, fim, pausa(id, inicio, fim), vaga(serie_id)')
      .eq('id', contratoId).eq('conta_id', conta.contaId).maybeSingle()
    if (!c) return { ok: false, erro: 'Contrato não encontrado.' }
    if (c.status !== 'pausado') {
      return { ok: false, erro: 'Este contrato não está trancado.' }
    }

    const aberta = (c.pausa ?? []).find((p) => p.fim === null)
    if (!aberta) return { ok: false, erro: 'Não há licença em aberto neste contrato.' }
    if (volta < aberta.inicio) {
      return { ok: false, erro: 'A volta não pode ser antes do começo da licença.' }
    }

    await db.from('pausa').update({ fim: volta }).eq('id', aberta.id)

    const series = [...new Set((c.vaga ?? []).map((v) => v.serie_id))]
    const recusa = await conferirVagas(
      db, conta.contaId, c.pessoa_id, series, hoje, contratoId)
    if (recusa) {
      // desfaz o fechamento da pausa: dizer "voltou" e não devolver o lugar é
      // pior do que dizer que o lugar não existe mais
      await db.from('pausa').update({ fim: null }).eq('id', aberta.id)
      return { ok: false, erro: `${recusa} A licença continua aberta.` }
    }

    if (series.length) {
      const { error } = await db.from('vaga').insert(series.map((serieId) => ({
        conta_id: conta.contaId, serie_id: serieId, pessoa_id: c.pessoa_id,
        inicio: volta, contrato_id: contratoId,
      })))
      if (error) throw error
    }

    await db.from('contrato').update({ status: 'ativo' }).eq('id', contratoId)
    await escreverVencimentoNaFicha(db, conta.contaId, c.pessoa_id)

    await registrar(db, {
      contaId: conta.contaId, entidade: 'contrato', entidadeId: contratoId,
      acao: 'reativou', detalhe: { volta },
    })

    revalidatePath(`/pessoas/${c.pessoa_id}`)
    return { ok: true }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Não foi possível retomar.' }
  }
}

/**
 * Encerrar: as vagas do contrato fecham na data, e o passado fica onde está.
 *
 * O contrato não é apagado. Ele nomeia o que já foi vendido, e o recibo do
 * módulo 18 vai apontar para ele.
 */
export async function encerrarContrato(
  contratoId: string, fim: string,
): Promise<Resultado> {
  try {
    const conta = await exigirOperacional()
    const db = await clienteServidor()

    const { data: c } = await db.from('contrato')
      .select('id, pessoa_id, inicio').eq('id', contratoId)
      .eq('conta_id', conta.contaId).maybeSingle()
    if (!c) return { ok: false, erro: 'Contrato não encontrado.' }
    if (fim < c.inicio) {
      return { ok: false, erro: 'O contrato não pode terminar antes de começar.' }
    }

    await db.from('contrato')
      .update({ status: 'encerrado', fim }).eq('id', contratoId)
    await db.from('vaga').update({ fim })
      .eq('contrato_id', contratoId).is('fim', null)

    await escreverVencimentoNaFicha(db, conta.contaId, c.pessoa_id)

    await registrar(db, {
      contaId: conta.contaId, entidade: 'contrato', entidadeId: contratoId,
      acao: 'encerrou', detalhe: { fim },
    })

    revalidatePath(`/pessoas/${c.pessoa_id}`)
    revalidatePath('/grade')
    return { ok: true }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Não foi possível encerrar.' }
  }
}
