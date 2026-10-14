import type { Db } from '../supabase'
import { registrar } from '../log'
import { hojeEm } from '../agenda/fuso'
import type { Forma } from '@/core/financeiro/fechamento'

export type NovoPagamento = {
  cobrancaId: string
  valorCent: number
  forma: Forma
  recebidoEm: string
  observacao: string | null
}

/**
 * Lançar o que entrou numa cobrança: o único caminho do dinheiro para o caixa.
 *
 * Mora fora do arquivo de Server Actions porque tem dois chamadores, o
 * "Registrar pagamento" do Financeiro e o Novo recibo que registra o
 * recebimento junto, e os dois precisam das mesmas recusas. Duas cópias
 * acabariam aceitando coisas diferentes.
 *
 * O valor não é conferido contra o da cobrança de propósito: quem paga a mais
 * (juro combinado no balcão) e quem paga a menos (o que sobrou de um acerto)
 * são os dois casos reais, e recusar qualquer um deles obrigaria a recepção a
 * mentir num campo para conseguir fechar o caixa.
 */
export async function lancarPagamento(
  db: Db, conta: { contaId: string; fuso: string }, p: NovoPagamento,
): Promise<{ ok: true; id: string; pessoaId: string } | { ok: false; erro: string }> {
  if (!Number.isInteger(p.valorCent) || p.valorCent <= 0) {
    return { ok: false, erro: 'O valor recebido precisa ser maior que zero.' }
  }
  // dinheiro que ainda não entrou não vai para o caixa: data futura faria o
  // fechamento de um dia que nem chegou já ter valor
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.recebidoEm) || Number.isNaN(Date.parse(p.recebidoEm))) {
    return { ok: false, erro: 'Escolha a data em que o pagamento foi recebido.' }
  }
  if (p.recebidoEm > hojeEm(conta.fuso)) {
    return { ok: false, erro: 'A data do pagamento não pode ser depois de hoje.' }
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
  const { data: novo, error } = await db.from('pagamento').insert({
    conta_id: conta.contaId,
    cobranca_id: p.cobrancaId,
    valor_cent: p.valorCent,
    forma: p.forma,
    recebido_em: p.recebidoEm,
    observacao: p.observacao,
    registrado_por_usuario_id: user?.id ?? null,
  }).select('id').single()
  if (error) throw error

  await registrar(db, {
    contaId: conta.contaId, entidade: 'pagamento', entidadeId: p.cobrancaId,
    acao: 'criou',
    detalhe: { valorCent: p.valorCent, forma: p.forma, recebidoEm: p.recebidoEm },
  })

  return { ok: true, id: novo.id, pessoaId: c.pessoa_id }
}
