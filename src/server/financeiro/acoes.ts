'use server'

import { revalidatePath } from 'next/cache'
import { clienteServidor, exigirConta } from '../conta'
import { registrar } from '../log'
import { hojeEm } from '../agenda/fuso'
import { materializarCobrancas } from './materializar'
import type { Forma } from '@/core/financeiro/fechamento'

/**
 * O dinheiro que entra, e a cobrança que o espera.
 *
 * Erro volta como **valor**, e não como exceção: o Next não deixa a mensagem de
 * um `Error` atravessar a Server Action, e quem precisa da frase ("esta
 * cobrança já foi paga") é justamente quem pode resolver sozinho. Mesmo formato
 * de `planos/acoes.ts` e `contratos/acoes.ts`.
 */
export type Resultado<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { valor: T }))
  | { ok: false; erro: string }

/**
 * Dinheiro é do dono e da recepção. Quem atende não vê nada disto.
 *
 * A conferência mora aqui, e não no banco: a tela some para quem não pode, mas
 * a ação continua sendo uma chamada de rede que qualquer sessão autenticada
 * consegue fazer, e a RLS isola conta, não papel.
 */
async function exigirCaixa() {
  const conta = await exigirConta()
  if (conta.papel !== 'dono' && conta.papel !== 'recepcao' && conta.papel !== 'suporte') {
    throw new Error('quem mexe em dinheiro é a recepção ou quem responde pelo negócio')
  }
  return conta
}

function falha(e: unknown, padrao: string): { ok: false; erro: string } {
  const m = e instanceof Error ? e.message : ''
  return { ok: false, erro: m || padrao }
}

/** A materialização chamada de uma tela, com o papel conferido. */
export async function materializarAgora(): Promise<Resultado<number>> {
  try {
    const conta = await exigirCaixa()
    const db = await clienteServidor()
    const criadas = await materializarCobrancas(db, conta.contaId, hojeEm(conta.fuso))
    if (criadas) revalidatePath('/financeiro')
    return { ok: true, valor: criadas }
  } catch (e) {
    return falha(e, 'Não foi possível atualizar as cobranças.')
  }
}

export type NovoPagamento = {
  cobrancaId: string
  valorCent: number
  forma: Forma
  recebidoEm: string
  observacao: string | null
}

/**
 * Registrar o que entrou.
 *
 * O valor não é conferido contra o da cobrança de propósito: quem paga a mais
 * (juro combinado no balcão) e quem paga a menos (o que sobrou de um acerto)
 * são os dois casos reais, e recusar qualquer um deles obrigaria a recepção a
 * mentir num campo para conseguir fechar o caixa.
 */
export async function registrarPagamento(p: NovoPagamento): Promise<Resultado> {
  try {
    const conta = await exigirCaixa()
    const db = await clienteServidor()

    if (!Number.isInteger(p.valorCent) || p.valorCent <= 0) {
      return { ok: false, erro: 'O valor recebido precisa ser maior que zero.' }
    }

    const { data: c } = await db.from('cobranca')
      .select('id, pessoa_id, status').eq('id', p.cobrancaId)
      .eq('conta_id', conta.contaId).maybeSingle()
    if (!c) return { ok: false, erro: 'Esta cobrança não existe mais.' }
    if (c.status === 'cancelada') {
      return {
        ok: false,
        erro: 'Esta cobrança está cancelada. Reabra antes de registrar o pagamento.',
      }
    }

    const { data: { user } } = await db.auth.getUser()
    const { error } = await db.from('pagamento').insert({
      conta_id: conta.contaId,
      cobranca_id: p.cobrancaId,
      valor_cent: p.valorCent,
      forma: p.forma,
      recebido_em: p.recebidoEm,
      observacao: p.observacao,
      registrado_por_usuario_id: user?.id ?? null,
    })
    if (error) throw error

    await registrar(db, {
      contaId: conta.contaId, entidade: 'pagamento', entidadeId: p.cobrancaId,
      acao: 'criou',
      detalhe: { valorCent: p.valorCent, forma: p.forma, recebidoEm: p.recebidoEm },
    })

    revalidatePath('/financeiro')
    revalidatePath(`/pessoas/${c.pessoa_id}`)
    return { ok: true }
  } catch (e) {
    return falha(e, 'Não foi possível registrar o pagamento.')
  }
}

/**
 * Estornar: a linha fica, o efeito sai, e o motivo fica escrito.
 *
 * Apagar faria o fechamento de ontem, que já foi conferido e talvez impresso,
 * mudar de valor sozinho. E é o estorno que o recibo do módulo 18 vai seguir
 * para se cancelar junto.
 */
export async function estornarPagamento(
  pagamentoId: string, motivo: string,
): Promise<Resultado> {
  try {
    const conta = await exigirCaixa()
    const db = await clienteServidor()

    if (!motivo.trim()) {
      return { ok: false, erro: 'Diga o motivo do estorno: sem ele, ninguém explica isto depois.' }
    }

    const { data: pg } = await db.from('pagamento')
      .select('id, estornado_em, cobranca(pessoa_id)').eq('id', pagamentoId)
      .eq('conta_id', conta.contaId).maybeSingle()
    if (!pg) return { ok: false, erro: 'Este pagamento não existe mais.' }
    if (pg.estornado_em) return { ok: false, erro: 'Este pagamento já foi estornado.' }

    const { error } = await db.from('pagamento').update({
      estornado_em: new Date().toISOString(), motivo_estorno: motivo.trim(),
    }).eq('id', pagamentoId)
    if (error) throw error

    /*
     * O recibo daquele pagamento cai junto, e com o motivo copiado.
     *
     * O papel que saiu continua existindo no mundo, e é justamente por isso que
     * ele precisa constar como cancelado aqui dentro: estorno sem cancelar o
     * comprovante deixa no ar um documento que diz que entrou dinheiro que
     * voltou. É também o que faz "estornos" e "recibos cancelados", os
     * relatórios 4 e 3 do item 4 do documento, contarem a mesma história.
     */
    await db.from('recibo').update({
      status: 'cancelado',
      motivo: `pagamento estornado: ${motivo.trim()}`,
      cancelado_em: new Date().toISOString(),
    }).eq('conta_id', conta.contaId).eq('pagamento_id', pagamentoId)
      .eq('status', 'valido')

    await registrar(db, {
      contaId: conta.contaId, entidade: 'pagamento', entidadeId: pagamentoId,
      acao: 'removeu', detalhe: { motivo: motivo.trim() },
    })

    revalidatePath('/financeiro')
    const pessoaId = pg.cobranca?.pessoa_id
    if (pessoaId) revalidatePath(`/pessoas/${pessoaId}`)
    return { ok: true }
  } catch (e) {
    return falha(e, 'Não foi possível estornar.')
  }
}

/**
 * Cancelar uma cobrança, com motivo.
 *
 * Cobrança cancelada não some da lista: some da soma. Buraco na sequência de
 * meses é a mesma pergunta que o buraco na numeração de recibo, e "essa nós
 * apagamos" não é resposta.
 */
export async function cancelarCobranca(
  cobrancaId: string, motivo: string,
): Promise<Resultado> {
  try {
    const conta = await exigirCaixa()
    const db = await clienteServidor()

    if (!motivo.trim()) {
      return { ok: false, erro: 'Diga o motivo do cancelamento.' }
    }

    const { data: c } = await db.from('cobranca_resumo')
      .select('id, pessoa_id, valor_pago_cent, situacao').eq('id', cobrancaId)
      .eq('conta_id', conta.contaId).maybeSingle()
    if (!c) return { ok: false, erro: 'Esta cobrança não existe mais.' }
    if ((c.valor_pago_cent ?? 0) > 0) {
      return {
        ok: false,
        erro: 'Esta cobrança já recebeu pagamento. Estorne o pagamento antes de cancelar.',
      }
    }

    const { error } = await db.from('cobranca').update({
      status: 'cancelada', motivo_cancelamento: motivo.trim(),
    }).eq('id', cobrancaId).eq('conta_id', conta.contaId)
    if (error) throw error

    await registrar(db, {
      contaId: conta.contaId, entidade: 'cobranca', entidadeId: cobrancaId,
      acao: 'encerrou', detalhe: { motivo: motivo.trim() },
    })

    revalidatePath('/financeiro')
    if (c.pessoa_id) revalidatePath(`/pessoas/${c.pessoa_id}`)
    return { ok: true }
  } catch (e) {
    return falha(e, 'Não foi possível cancelar a cobrança.')
  }
}

/**
 * Reabrir o que foi cancelado por engano.
 *
 * Sem isto, o único caminho de volta seria materializar de novo, e a
 * materialização não recria o que já existe: a competência ficaria cancelada
 * para sempre por causa de um clique.
 */
export async function reabrirCobranca(cobrancaId: string): Promise<Resultado> {
  try {
    const conta = await exigirCaixa()
    const db = await clienteServidor()

    const { data: c } = await db.from('cobranca')
      .select('id, pessoa_id, status').eq('id', cobrancaId)
      .eq('conta_id', conta.contaId).maybeSingle()
    if (!c) return { ok: false, erro: 'Esta cobrança não existe mais.' }
    if (c.status !== 'cancelada') {
      return { ok: false, erro: 'Esta cobrança já está aberta.' }
    }

    const { error } = await db.from('cobranca')
      .update({ status: 'aberta', motivo_cancelamento: null })
      .eq('id', cobrancaId).eq('conta_id', conta.contaId)
    if (error) throw error

    await registrar(db, {
      contaId: conta.contaId, entidade: 'cobranca', entidadeId: cobrancaId,
      acao: 'reativou',
    })

    revalidatePath('/financeiro')
    revalidatePath(`/pessoas/${c.pessoa_id}`)
    return { ok: true }
  } catch (e) {
    return falha(e, 'Não foi possível reabrir a cobrança.')
  }
}

/**
 * Corrigir o valor de uma cobrança que ainda não recebeu nada.
 *
 * Negociação existe: o preço congelado do contrato é o que foi vendido, e a
 * cobrança de dezembro pode ter desconto de férias. O que não existe é editar
 * valor de cobrança já paga, e por isso o caminho de volta ali é o estorno.
 */
export async function corrigirValor(
  cobrancaId: string, valorCent: number, motivo: string,
): Promise<Resultado> {
  try {
    const conta = await exigirCaixa()
    const db = await clienteServidor()

    if (!Number.isInteger(valorCent) || valorCent < 0) {
      return { ok: false, erro: 'O valor precisa ser um número em reais.' }
    }
    if (!motivo.trim()) {
      return { ok: false, erro: 'Diga por que o valor mudou: seis meses depois, ninguém lembra.' }
    }

    const { data: c } = await db.from('cobranca_resumo')
      .select('id, pessoa_id, valor_cent, valor_pago_cent').eq('id', cobrancaId)
      .eq('conta_id', conta.contaId).maybeSingle()
    if (!c) return { ok: false, erro: 'Esta cobrança não existe mais.' }
    if ((c.valor_pago_cent ?? 0) > 0) {
      return {
        ok: false,
        erro: 'Esta cobrança já recebeu pagamento, e o valor dela não muda mais. Estorne antes.',
      }
    }

    const { error } = await db.from('cobranca')
      .update({ valor_cent: valorCent })
      .eq('id', cobrancaId).eq('conta_id', conta.contaId)
    if (error) throw error

    await registrar(db, {
      contaId: conta.contaId, entidade: 'cobranca', entidadeId: cobrancaId,
      acao: 'editou',
      detalhe: { de: c.valor_cent, para: valorCent, motivo: motivo.trim() },
    })

    revalidatePath('/financeiro')
    if (c.pessoa_id) revalidatePath(`/pessoas/${c.pessoa_id}`)
    return { ok: true }
  } catch (e) {
    return falha(e, 'Não foi possível corrigir o valor.')
  }
}

