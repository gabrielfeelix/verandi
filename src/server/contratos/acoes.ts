'use server'

import { revalidatePath } from 'next/cache'
import { clienteServidor, exigirConta } from '../conta'
import { registrar } from '../log'
import { hojeEm } from '../agenda/fuso'
import { incluirVagasNasSessoes, tirarDasAulasDepoisDoFim } from '../agenda/materializar'
import { avisarQuemEspera } from '../agenda/espera'
import { temVinculo } from './consultas'
import { precoAplicado, type Recorrencia } from '@/core/planos/plano'
import { fimDoContrato } from '@/core/contratos/contrato'
import { escreverVencimentoNaFicha } from '../licencas/prorrogacao'
import {
  cancelarCobrancasFuturas, materializarCobrancas, sincronizarCobrancas,
} from '../financeiro/materializar'
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
  /** horários escolhidos cheios, de propósito: entram acima do limite da turma */
  acimaDoLimite?: string[]
  inicio: string
  diaVencimento: number | null
  formaPagamento: string | null
  /** quanto sai do preço do plano, em centavos; com motivo obrigatório */
  descontoCent?: number
  descontoMotivo?: string | null
  /**
   * O contrato inteiro pago de uma vez (à vista, ou no cartão parcelado pela
   * maquininha): vira uma cobrança só, do valor total, em vez de uma por mês.
   */
  recebidoDeUmaVez?: boolean
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
      .select('id, nome, servico_id, recorrencia, frequencia_semanal, horario_livre, sessoes_no_pacote, validade_meses, preco_vinculado_cent, preco_avulso_cent, ativo')
      .eq('id', novo.planoId).eq('conta_id', conta.contaId)
      .maybeSingle()
    if (!plano) return { ok: false, erro: 'Esse plano não existe mais nesta conta.' }
    if (!plano.ativo) {
      return { ok: false, erro: `O plano ${plano.nome} saiu de uso. Escolha outro, ou volte a usá-lo em Configuração.` }
    }

    // horário livre não ocupa a grade: cada aula é marcada quando a pessoa vem
    const pedidas = plano.horario_livre ? [] : [...new Set(novo.serieIds)].filter(Boolean)
    const exigidas = plano.horario_livre ? 0 : plano.frequencia_semanal ?? 0
    if (exigidas && pedidas.length !== exigidas) {
      return {
        ok: false,
        erro: `Este plano pede ${exigidas} ${exigidas === 1 ? 'horário' : 'horários'}, e ${pedidas.length} ${pedidas.length === 1 ? 'foi escolhido' : 'foram escolhidos'}.`,
      }
    }

    const { recusa, adotar } = await conferirVagas(
      db, conta.contaId, novo.pessoaId, pedidas, hoje, { adotarSoltas: true, inicioNovo: novo.inicio, acimaDoLimite: novo.acimaDoLimite })
    if (recusa) return { ok: false, erro: recusa }
    // quem já tinha o lugar fica com ele: a vaga é a mesma, só ganha contrato
    const adotadas = new Set(adotar.map((v) => v.serieId))
    const novas = pedidas.filter((id) => !adotadas.has(id))

    const vinculo = await temVinculo(
      db, conta.contaId, novo.pessoaId, plano.servico_id, hoje)
    const preco = precoAplicado({
      precoVinculadoCent: plano.preco_vinculado_cent,
      precoAvulsoCent: plano.preco_avulso_cent,
    }, vinculo)

    const desconto = Math.max(0, Math.trunc(novo.descontoCent ?? 0))
    const motivoDesconto = novo.descontoMotivo?.trim() || null
    if (desconto > 0 && !motivoDesconto) {
      return { ok: false, erro: 'Diga o motivo do desconto: ele sai no recibo, e seis meses depois ninguém lembra.' }
    }
    if (desconto >= preco.cent) {
      return { ok: false, erro: `O desconto não pode ser igual ou maior que o preço do plano (${(preco.cent / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}).` }
    }

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
      preco_aplicado_cent: preco.cent - desconto,
      desconto_cent: desconto,
      desconto_motivo: desconto > 0 ? motivoDesconto : null,
      parcelas: novo.recebidoDeUmaVez ? 1 : null,
      vinculo_usado: preco.vinculo,
      forma_pagamento: novo.formaPagamento,
      sessoes_contratadas: plano.sessoes_no_pacote,
      criado_por_usuario_id: user?.id ?? null,
    }).select('id').single<{ id: string }>()
    if (error) throw error

    if (novas.length) {
      const { error: erroVaga } = await db.from('vaga').insert(novas.map((serieId) => ({
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
      await incluirVagasNasSessoes(db, conta.contaId, conta.fuso, novas.map((serieId) => ({
        serie_id: serieId, pessoa_id: novo.pessoaId, inicio: novo.inicio,
      })))
    }

    if (adotar.length) {
      // a vaga adotada já está nas aulas geradas: não há o que incluir, só
      // dizer de qual contrato ela é. O filtro `contrato_id is null` impede de
      // roubar a vaga de outro contrato que tenha chegado entre a conferência
      // e aqui
      const { error: erroAdocao } = await db.from('vaga')
        .update({ contrato_id: contrato.id })
        .in('id', adotar.map((v) => v.id))
        .is('contrato_id', null)
      if (erroAdocao) {
        await db.from('vaga').delete().eq('contrato_id', contrato.id)
        await db.from('contrato').delete().eq('id', contrato.id)
        throw erroAdocao
      }
    }

    await escreverVencimentoNaFicha(db, conta.contaId, novo.pessoaId)

    /*
     * A primeira cobrança nasce agora, e não na próxima vez que alguém abrir o
     * financeiro. Quem acabou de matricular está com a pessoa na frente e vai
     * receber o primeiro mês ali mesmo; achar a cobrança só amanhã seria pedir
     * para a recepção anotar num papel o que o sistema existe para guardar.
     */
    await materializarCobrancas(db, conta.contaId, hoje, contrato.id)

    await registrar(db, {
      contaId: conta.contaId, entidade: 'contrato', entidadeId: contrato.id,
      acao: 'criou',
      detalhe: { plano: plano.nome, precoCent: preco.cent, vinculo: preco.vinculo },
    })

    revalidatePath(`/pessoas/${novo.pessoaId}`)
    revalidatePath('/grade')
    revalidatePath('/semana')
    revalidatePath('/financeiro')
    return { ok: true, valor: contrato.id }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Não foi possível matricular.' }
  }
}

/**
 * Os horários cabem, e a pessoa já não está neles?
 *
 * Devolve a frase da recusa, ou `null` quando tudo passa. A conferência é de
 * todos antes de gravar qualquer um.
 *
 * Com `adotarSoltas`, a matrícula que a pessoa já tem no horário sem contrato
 * nenhum deixa de ser recusa e volta em `adotar`: é o caso de quem foi
 * matriculado antes de existir contrato, e recusar obrigava a encerrar a
 * matrícula para poder criar o contrato que a descreve.
 */
async function conferirVagas(
  db: Awaited<ReturnType<typeof clienteServidor>>,
  contaId: string, pessoaId: string, serieIds: string[], hoje: string,
  opcoes: {
    /*
     * Ao retomar uma licença, as vagas do próprio contrato ainda estão lá, com
     * data de fim: sem ignorá-las, o sistema recusaria devolver o lugar de
     * alguém dizendo que ela já o ocupa.
     */
    ignorarContrato?: string
    adotarSoltas?: boolean
    /*
     * O começo do contrato novo, para a troca de contrato: quem encerrou o
     * contrato antigo e abre outro no mesmo horário continua no lugar dela,
     * e a turma cheia não pode barrá-la por causa da própria vaga.
     */
    inicioNovo?: string
    /** os horários que a recepção escolheu cheios, sabendo: a lotação não barra */
    acimaDoLimite?: string[]
  } = {},
): Promise<{ recusa: string | null; adotar: Array<{ id: string; serieId: string }> }> {
  const adotar: Array<{ id: string; serieId: string }> = []
  if (!serieIds.length) return { recusa: null, adotar }

  const { data: series } = await db.from('serie')
    .select('id, dia_semana, hora_inicio, capacidade, codigo, vaga(id, pessoa_id, inicio, fim, contrato_id)')
    .eq('conta_id', contaId).in('id', serieIds)

  if (!series || series.length !== serieIds.length) {
    return { recusa: 'Um dos horários escolhidos não existe mais.', adotar }
  }

  for (const s of series) {
    const nome = `${DIAS_INTEIROS[s.dia_semana]} às ${String(s.hora_inicio).slice(0, 5)}`
    // viva é a que ainda não terminou, inclusive a que começa mais para a
    // frente: o lugar de quem entra em setembro já está ocupado hoje
    const vivas = (s.vaga ?? [])
      .filter((v) => v.contrato_id !== opcoes.ignorarContrato)
      .filter((v) => v.fim === null || v.fim >= hoje)

    const dela = vivas.find((v) => v.pessoa_id === pessoaId)
    if (dela) {
      if (opcoes.adotarSoltas && dela.contrato_id === null && dela.fim === null) {
        // ela já conta na ocupação: adotar não tira lugar de ninguém, então a
        // conferência de lotação não se aplica a este horário
        adotar.push({ id: dela.id, serieId: s.id })
        continue
      }
      /*
       * Troca de contrato: a vaga dela tem saída marcada (o contrato antigo foi
       * encerrado) e o novo começa a partir dessa data. Ela continua no mesmo
       * lugar, e a lotação não se aplica: ninguém perde vaga para ela, que só
       * substitui a si mesma (Caroline, MGM, 09/out/2026).
       */
      if (opcoes.inicioNovo && dela.contrato_id !== null && dela.fim !== null
        && opcoes.inicioNovo >= dela.fim) continue
      const ate = dela.fim ? `${dela.fim.slice(8, 10)}/${dela.fim.slice(5, 7)}` : null
      return {
        recusa: dela.contrato_id
          ? ate
            ? `Esta pessoa ocupa o horário de ${nome} pelo contrato atual até ${ate}. Comece o novo contrato a partir de ${ate}.`
            : `Esta pessoa já ocupa o horário de ${nome} pelo contrato atual. Encerre o contrato atual e faça a matrícula nova: o lugar dela fica guardado.`
          : `Esta pessoa já ocupa o horário de ${nome}, com saída marcada.`,
        adotar,
      }
    }
    if (vivas.length >= s.capacidade && !opcoes.acimaDoLimite?.includes(s.id)) {
      return { recusa: `O horário de ${nome} está cheio: ${vivas.length} de ${s.capacidade}.`, adotar }
    }
  }
  return { recusa: null, adotar }
}

export type Renovacao = {
  inicio: string
  formaPagamento: string | null
  descontoCent?: number
  descontoMotivo?: string | null
  recebidoDeUmaVez?: boolean
}

/**
 * Renovar: o contrato seguinte, já preenchido.
 *
 * "Registrar renovação" na ficha só mudava a data de vencimento, e renovar de
 * verdade era fazer um "Novo contrato" à mão, escolhendo de novo plano e
 * horários. Quem não fazia isso deixava o aluno sem cobrança a partir do fim,
 * ou recebia na cobrança errada do contrato velho (Arnaldo Bernal, MGM,
 * 13/10/2026: R$ 525 lançados no mês do fim do anual antigo).
 *
 * Mesmo plano, pelo preço de hoje (com o desconto, se houver), os mesmos
 * horários passados para o contrato novo, e o velho encerrado no dia anterior
 * ao início do novo. As cobranças do velho que ainda estão abertas e sem
 * pagamento a partir do mês da renovação são canceladas: são do período que
 * agora é do contrato novo.
 */
export async function renovarContrato(
  contratoId: string, r: Renovacao,
): Promise<Resultado<string>> {
  try {
    const conta = await exigirOperacional()
    const db = await clienteServidor()
    const hoje = hojeEm(conta.fuso)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.inicio)) return { ok: false, erro: 'Diga quando o contrato novo começa.' }

    const { data: velho } = await db.from('contrato')
      .select(`id, pessoa_id, dia_vencimento, inicio, fim, status,
               plano(id, nome, servico_id, recorrencia, validade_meses, sessoes_no_pacote,
                     preco_vinculado_cent, preco_avulso_cent, ativo)`)
      .eq('id', contratoId).eq('conta_id', conta.contaId).maybeSingle()
    if (!velho?.plano) return { ok: false, erro: 'Este contrato não existe mais.' }
    /*
     * Renovar duas vezes criava dois contratos novos e uma pessoa pagando o
     * trimestre em dobro (Luz Marina, MGM, 19/10/2026: "Renovar" às 13:59 no
     * contrato em vigor e às 14:00 no que tinha acabado de nascer). Só se
     * renova o contrato que está valendo, e uma vez.
     */
    // Encerrado só se renova quando a pessoa não tem outro em vigor: é o aluno
    // que voltou depois de o plano acabar. A mesma regra do botão na ficha.
    if (velho.status !== 'ativo') {
      const { count: emVigor } = await db.from('contrato')
        .select('id', { count: 'exact', head: true })
        .eq('conta_id', conta.contaId).eq('pessoa_id', velho.pessoa_id)
        .neq('status', 'encerrado').neq('id', velho.id)
      if (velho.status !== 'encerrado' || (emVigor ?? 0) > 0) {
        return { ok: false, erro: 'Este contrato já foi renovado ou não está em vigor. Renove o que está em vigor.' }
      }
    }
    if (velho.inicio > hoje) {
      return {
        ok: false,
        erro: 'Este contrato ainda não começou: ele já é a renovação do anterior. Para mudar algo nele, encerre e crie de novo.',
      }
    }
    if (r.inicio <= velho.inicio) {
      return { ok: false, erro: 'O contrato novo precisa começar depois do início do atual.' }
    }
    const plano = velho.plano
    if (!plano.ativo) {
      return { ok: false, erro: `O plano ${plano.nome} saiu de uso. Use "Novo contrato" e escolha outro plano.` }
    }

    const vinculo = await temVinculo(db, conta.contaId, velho.pessoa_id, plano.servico_id, hoje)
    const preco = precoAplicado({
      precoVinculadoCent: plano.preco_vinculado_cent,
      precoAvulsoCent: plano.preco_avulso_cent,
    }, vinculo)
    const desconto = Math.max(0, Math.trunc(r.descontoCent ?? 0))
    const motivoDesconto = r.descontoMotivo?.trim() || null
    if (desconto > 0 && !motivoDesconto) {
      return { ok: false, erro: 'Diga o motivo do desconto: ele sai no recibo, e seis meses depois ninguém lembra.' }
    }
    if (desconto >= preco.cent) {
      return { ok: false, erro: 'O desconto não pode ser igual ou maior que o preço do plano.' }
    }
    const fim = fimDoContrato(r.inicio, {
      recorrencia: plano.recorrencia as Recorrencia,
      validadeMeses: plano.validade_meses,
    })

    const { data: { user } } = await db.auth.getUser()
    const { data: novo, error } = await db.from('contrato').insert({
      conta_id: conta.contaId,
      pessoa_id: velho.pessoa_id,
      plano_id: plano.id,
      inicio: r.inicio,
      fim,
      dia_vencimento: velho.dia_vencimento,
      preco_aplicado_cent: preco.cent - desconto,
      desconto_cent: desconto,
      desconto_motivo: desconto > 0 ? motivoDesconto : null,
      parcelas: r.recebidoDeUmaVez ? 1 : null,
      vinculo_usado: preco.vinculo,
      forma_pagamento: r.formaPagamento,
      sessoes_contratadas: plano.sessoes_no_pacote,
      criado_por_usuario_id: user?.id ?? null,
    }).select('id').single<{ id: string }>()
    if (error) throw error

    // os horários seguem com a pessoa: a vaga é a mesma, só muda de contrato
    const { error: erroVagas } = await db.from('vaga')
      .update({ contrato_id: novo.id })
      .eq('contrato_id', velho.id)
      .or(`fim.is.null,fim.gte.${r.inicio}`)
    if (erroVagas) {
      await db.from('contrato').delete().eq('id', novo.id)
      throw erroVagas
    }

    const vespera = new Date(`${r.inicio}T12:00:00Z`)
    vespera.setUTCDate(vespera.getUTCDate() - 1)
    const fimDoVelho = vespera.toISOString().slice(0, 10)
    // Falhar aqui deixava dois contratos em vigor sem ninguém saber: o erro
    // não era lido. Agora desfaz o novo e devolve as vagas.
    const { error: erroDoVelho } = await db.from('contrato').update({
      status: 'encerrado',
      ...(velho.fim === null || velho.fim > fimDoVelho ? { fim: fimDoVelho } : {}),
    }).eq('id', velho.id)
    if (erroDoVelho) {
      await db.from('vaga').update({ contrato_id: velho.id }).eq('contrato_id', novo.id)
      await db.from('contrato').delete().eq('id', novo.id)
      throw erroDoVelho
    }

    const { data: abertas } = await db.from('cobranca')
      .select('id, pagamento(id, estornado_em)')
      .eq('contrato_id', velho.id).eq('status', 'aberta')
      .gte('competencia', `${r.inicio.slice(0, 7)}-01`)
    const semPagamento = (abertas ?? [])
      .filter((c) => !(c.pagamento ?? []).some((p) => p.estornado_em === null))
      .map((c) => c.id)
    if (semPagamento.length) {
      await db.from('cobranca').update({
        status: 'cancelada',
        motivo_cancelamento: 'Renovação: o período agora é do contrato novo.',
      }).in('id', semPagamento)
    }

    await escreverVencimentoNaFicha(db, conta.contaId, velho.pessoa_id)
    await materializarCobrancas(db, conta.contaId, hoje, novo.id)
    await registrar(db, {
      contaId: conta.contaId, entidade: 'contrato', entidadeId: novo.id,
      acao: 'criou',
      detalhe: { renovou: velho.id, plano: plano.nome, precoCent: preco.cent - desconto, descontoCent: desconto },
    })

    revalidatePath(`/pessoas/${velho.pessoa_id}`)
    revalidatePath('/financeiro')
    return { ok: true, valor: novo.id }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Não foi possível renovar.' }
  }
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
    const { data: fechadas } = await db.from('vaga').update({ fim: inicio })
      .eq('contrato_id', contratoId).is('fim', null).select('serie_id, pessoa_id, fim')
    await liberarLugares(db, conta.contaId, conta.fuso, fechadas ?? [])

    // a cobrança do mês que já nasceu à frente não pode virar dívida de um mês
    // em que a pessoa não pode entrar na sala
    await sincronizarCobrancas(db, conta.contaId, contratoId, hojeEm(conta.fuso))

    await registrar(db, {
      contaId: conta.contaId, entidade: 'contrato', entidadeId: contratoId,
      acao: 'encerrou', detalhe: { pausa: inicio, motivo },
    })

    revalidatePath(`/pessoas/${c.pessoa_id}`)
    revalidatePath('/financeiro')
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
    const { recusa } = await conferirVagas(
      db, conta.contaId, c.pessoa_id, series, hoje, { ignorarContrato: contratoId })
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
      await incluirVagasNasSessoes(db, conta.contaId, conta.fuso, series.map((serieId) => ({
        serie_id: serieId, pessoa_id: c.pessoa_id, inicio: volta,
      })))
    }

    await db.from('contrato').update({ status: 'ativo' }).eq('id', contratoId)
    await escreverVencimentoNaFicha(db, conta.contaId, c.pessoa_id)
    // o caminho de volta: os meses que voltaram a ser devidos reabrem
    await sincronizarCobrancas(db, conta.contaId, contratoId, hoje)

    await registrar(db, {
      contaId: conta.contaId, entidade: 'contrato', entidadeId: contratoId,
      acao: 'reativou', detalhe: { volta },
    })

    revalidatePath(`/pessoas/${c.pessoa_id}`)
    revalidatePath('/financeiro')
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
    const { data: fechadas } = await db.from('vaga').update({ fim })
      .eq('contrato_id', contratoId).is('fim', null).select('serie_id, pessoa_id, fim')
    await liberarLugares(db, conta.contaId, conta.fuso, fechadas ?? [])

    /*
     * O que ainda não venceu é cancelado; o que venceu e não foi pago fica.
     * Quem saiu devendo continua devendo, e apagar a dívida no ato do
     * encerramento é o jeito mais rápido de o sistema perder dinheiro do
     * cliente sem ninguém perceber.
     */
    await cancelarCobrancasFuturas(db, conta.contaId, contratoId, fim)

    await escreverVencimentoNaFicha(db, conta.contaId, c.pessoa_id)

    await registrar(db, {
      contaId: conta.contaId, entidade: 'contrato', entidadeId: contratoId,
      acao: 'encerrou', detalhe: { fim },
    })

    revalidatePath(`/pessoas/${c.pessoa_id}`)
    revalidatePath('/grade')
    revalidatePath('/financeiro')
    return { ok: true }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Não foi possível encerrar.' }
  }
}

/** As aulas já geradas depois do fim das vagas soltam o lugar, e a fila sabe. */
async function liberarLugares(
  db: Awaited<ReturnType<typeof clienteServidor>>, contaId: string, fuso: string,
  vagas: Array<{ serie_id: string; pessoa_id: string; fim: string | null }>,
) {
  const sessoes = await tirarDasAulasDepoisDoFim(db, contaId, fuso, vagas)
  for (const id of sessoes) await avisarQuemEspera(db, contaId, id)
  if (sessoes.length) revalidatePath('/semana')
}
