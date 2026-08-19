'use server'

import { revalidatePath } from 'next/cache'
import { clienteServidor, exigirConta } from '../conta'
import { registrar } from '../log'
import {
  emitenteCompleto, montarCorpo, numeroFormatado, podeCancelar, podeCorrigir,
  type StatusRecibo,
} from '@/core/recibo/recibo'
import { competenciaPorExtenso } from '@/core/financeiro/cobranca'
import { ROTULO_FORMA, type Forma } from '@/core/financeiro/fechamento'
import type { Json } from '../banco.types'

/**
 * Emitir, corrigir e cancelar o papel.
 *
 * Erro volta como **valor**: quem precisa da frase ("preencha os dados de quem
 * emite, em Configuração") é justamente quem pode resolver sozinho, e o Next
 * não deixa a mensagem de uma exceção atravessar a Server Action.
 */
export type Resultado<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { valor: T }))
  | { ok: false; erro: string }

function falha(e: unknown, padrao: string): { ok: false; erro: string } {
  const m = e instanceof Error ? e.message : ''
  return { ok: false, erro: m || padrao }
}

/** Recibo é do dono e da recepção. Quem atende não emite nem lê. */
async function exigirCaixa() {
  const conta = await exigirConta()
  if (conta.papel !== 'dono' && conta.papel !== 'recepcao' && conta.papel !== 'suporte') {
    throw new Error('quem emite recibo é a recepção ou quem responde pelo negócio')
  }
  return conta
}

/**
 * Emitir o recibo de um pagamento.
 *
 * O número é alocado pelo banco, com trava de linha: dois balcões clicando ao
 * mesmo tempo recebem números diferentes. E ele é alocado **depois** de tudo
 * que pode falhar, porque número alocado e não gravado é buraco na sequência,
 * que é exatamente o que este módulo existe para não ter.
 */
export async function emitirRecibo(pagamentoId: string): Promise<Resultado<string>> {
  try {
    const conta = await exigirCaixa()
    const db = await clienteServidor()

    const { data: c } = await db.from('conta')
      .select('nome, razao_social, documento, endereco_emitente, telefone_emitente, serie_recibo')
      .eq('id', conta.contaId).single()

    const emitente = {
      razaoSocial: c?.razao_social ?? null,
      documento: c?.documento ?? null,
      endereco: c?.endereco_emitente ?? null,
      telefone: c?.telefone_emitente ?? null,
      nomeDaConta: c?.nome ?? '',
    }
    if (!emitenteCompleto(emitente)) {
      return {
        ok: false,
        erro: 'Preencha quem emite o recibo em Configuração, Recibo: sem razão social e documento, o papel não comprova nada.',
      }
    }

    const { data: pg } = await db.from('pagamento')
      .select(`id, valor_cent, forma, recebido_em, estornado_em,
               cobranca(competencia, contrato_id,
                        pessoa(id, nome, cpf, identificador_externo, endereco,
                               endereco_numero, bairro, cidade, uf),
                        contrato(plano(nome)))`)
      .eq('id', pagamentoId).eq('conta_id', conta.contaId).maybeSingle()
    if (!pg) return { ok: false, erro: 'Este pagamento não existe mais.' }
    if (pg.estornado_em) {
      return { ok: false, erro: 'Este pagamento foi estornado, e não há o que comprovar.' }
    }

    const { data: jaTem } = await db.from('recibo')
      .select('id, serie, numero').eq('pagamento_id', pagamentoId)
      .eq('conta_id', conta.contaId).eq('status', 'valido').maybeSingle()
    if (jaTem) {
      return {
        ok: false,
        erro: `Este pagamento já tem o recibo ${numeroFormatado(jaTem.serie, jaTem.numero)}. Imprima a segunda via em Recibos.`,
      }
    }

    const pessoa = pg.cobranca?.pessoa
    const { data: { user } } = await db.auth.getUser()
    const { data: quemEmite } = await db.from('profissional')
      .select('nome').eq('conta_id', conta.contaId)
      .eq('usuario_id', user?.id ?? '').maybeSingle()

    /*
     * **Nunca o e-mail.** Quem responde pelo negócio raramente está cadastrado
     * como profissional, então o caminho comum caía no e-mail dele, e ele saía
     * impresso na via que fica com o aluno. Endereço pessoal de quem manda no
     * estúdio, entregue a cada pagamento a quem só precisa saber que pagou.
     *
     * Sem nome de gente, a linha sai sem o "por fulano": quem emitiu continua
     * gravado em `emitido_por_usuario_id`, que é auditoria e não papel.
     */
    const nomeDeQuemEmite = quemEmite?.nome?.trim() || ''

    const endereco = [
      pessoa?.endereco, pessoa?.endereco_numero, pessoa?.bairro,
      pessoa?.cidade, pessoa?.uf,
    ].filter(Boolean).join(', ')

    const corpo = montarCorpo({
      emitente,
      pagador: {
        nome: pessoa?.nome ?? 'Não informado',
        documento: pessoa?.cpf ?? null,
        matricula: pessoa?.identificador_externo ?? null,
        endereco: endereco || null,
      },
      referente: [
        pg.cobranca?.contrato?.plano?.nome,
        pg.cobranca?.competencia
          ? competenciaPorExtenso(pg.cobranca.competencia) : null,
      ].filter(Boolean).join(', ') || 'Serviços prestados',
      valorCent: pg.valor_cent,
      forma: ROTULO_FORMA[pg.forma as Forma] ?? pg.forma,
      recebidoEm: pg.recebido_em,
      emitidoPor: nomeDeQuemEmite,
      emitidoEm: new Date().toISOString(),
    })

    const serie = c?.serie_recibo ?? 'A'
    const { data: numero, error: erroNumero } = await db
      .rpc('proximo_numero_recibo', { p_conta: conta.contaId, p_serie: serie })
    if (erroNumero) throw erroNumero

    const { data: recibo, error } = await db.from('recibo').insert({
      conta_id: conta.contaId,
      serie,
      numero: numero as number,
      pagamento_id: pagamentoId,
      pessoa_id: pessoa?.id ?? null,
      contrato_id: pg.cobranca?.contrato_id ?? null,
      valor_cent: pg.valor_cent,
      corpo: corpo as unknown as Json,
      emitido_por_usuario_id: user?.id ?? null,
    }).select('id').single()
    if (error) throw error

    await registrar(db, {
      contaId: conta.contaId, entidade: 'recibo', entidadeId: recibo.id,
      acao: 'criou',
      detalhe: { numero: numeroFormatado(serie, numero as number), valorCent: pg.valor_cent },
    })

    revalidatePath('/recibos')
    revalidatePath('/financeiro')
    return { ok: true, valor: recibo.id }
  } catch (e) {
    return falha(e, 'Não foi possível emitir o recibo.')
  }
}

/**
 * Cancelar, com motivo.
 *
 * O número fica cancelado e ocupado. Buraco na sequência é a primeira coisa que
 * uma fiscalização pergunta, e a via impressa continua existindo no mundo: o
 * que o sistema pode fazer é registrar que ela não vale mais.
 */
export async function cancelarRecibo(
  id: string, motivo: string,
): Promise<Resultado> {
  try {
    const conta = await exigirCaixa()
    const db = await clienteServidor()

    if (!motivo.trim()) {
      return { ok: false, erro: 'Diga o motivo do cancelamento: o número continua ocupado, e alguém vai perguntar por quê.' }
    }

    const { data: r } = await db.from('recibo')
      .select('id, status, serie, numero').eq('id', id)
      .eq('conta_id', conta.contaId).maybeSingle()
    if (!r) return { ok: false, erro: 'Este recibo não existe mais.' }
    if (!podeCancelar(r.status as StatusRecibo)) {
      return { ok: false, erro: 'Só um recibo válido pode ser cancelado.' }
    }

    const { error } = await db.from('recibo').update({
      status: 'cancelado', motivo: motivo.trim(),
      cancelado_em: new Date().toISOString(),
    }).eq('id', id).eq('conta_id', conta.contaId)
    if (error) throw error

    await registrar(db, {
      contaId: conta.contaId, entidade: 'recibo', entidadeId: id,
      acao: 'encerrou',
      detalhe: { numero: numeroFormatado(r.serie, r.numero), motivo: motivo.trim() },
    })

    revalidatePath('/recibos')
    revalidatePath('/financeiro')
    return { ok: true }
  } catch (e) {
    return falha(e, 'Não foi possível cancelar o recibo.')
  }
}

/**
 * Corrigir: versão nova do mesmo número, e a anterior fica guardada.
 *
 * O documento pede "poderá ser corrigido", e a via impressa continua na pasta
 * do cliente: sobrescrever o texto faria o sistema discordar do papel. A versão
 * anterior vira `substituido` e continua legível.
 *
 * O que se corrige é o **texto**, e não o valor: valor errado é estorno e
 * pagamento novo, senão o recibo passaria a dizer uma coisa e o caixa outra.
 */
export async function corrigirRecibo(
  id: string, correcoes: { pagadorNome?: string; pagadorDocumento?: string; referente?: string },
  motivo: string,
): Promise<Resultado<string>> {
  try {
    const conta = await exigirCaixa()
    const db = await clienteServidor()

    if (!motivo.trim()) {
      return { ok: false, erro: 'Diga o que estava errado: a via antiga continua na mão de alguém.' }
    }

    const { data: r } = await db.from('recibo').select('*')
      .eq('id', id).eq('conta_id', conta.contaId).maybeSingle()
    if (!r) return { ok: false, erro: 'Este recibo não existe mais.' }
    if (!podeCorrigir(r.status as StatusRecibo)) {
      return { ok: false, erro: 'Só um recibo válido pode ser corrigido.' }
    }

    const corpoAntigo = r.corpo as Record<string, unknown>
    const corpoNovo = {
      ...corpoAntigo,
      ...(correcoes.pagadorNome?.trim()
        ? { pagadorNome: correcoes.pagadorNome.trim() } : {}),
      ...(correcoes.pagadorDocumento?.trim()
        ? { pagadorDocumento: correcoes.pagadorDocumento.trim() } : {}),
      ...(correcoes.referente?.trim() ? { referente: correcoes.referente.trim() } : {}),
    }

    const { data: { user } } = await db.auth.getUser()
    const { data: novo, error } = await db.from('recibo').insert({
      conta_id: conta.contaId,
      serie: r.serie,
      numero: r.numero,
      versao: r.versao + 1,
      pagamento_id: r.pagamento_id,
      pessoa_id: r.pessoa_id,
      contrato_id: r.contrato_id,
      substitui_id: r.id,
      valor_cent: r.valor_cent,
      corpo: corpoNovo as unknown as Json,
      motivo: motivo.trim(),
      emitido_por_usuario_id: user?.id ?? null,
    }).select('id').single()
    if (error) throw error

    await db.from('recibo').update({ status: 'substituido' }).eq('id', r.id)

    await registrar(db, {
      contaId: conta.contaId, entidade: 'recibo', entidadeId: novo.id,
      acao: 'editou',
      detalhe: {
        numero: numeroFormatado(r.serie, r.numero),
        versao: r.versao + 1, motivo: motivo.trim(),
      },
    })

    revalidatePath('/recibos')
    return { ok: true, valor: novo.id }
  } catch (e) {
    return falha(e, 'Não foi possível corrigir o recibo.')
  }
}
