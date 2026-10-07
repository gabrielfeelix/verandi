import type { Db } from '../supabase'

/**
 * Quem tinha lugar numa aula que o estúdio cancelou sai com reposição em
 * aberto.
 *
 * O crédito de reposição é a participação `cancelada` (`/pendencias` lê esse
 * status). Cancelar só a sessão deixava a pessoa `esperada` numa aula riscada:
 * sem aula e sem crédito. Vale para o cancelamento de uma aula, para a data
 * fechada e para a aula que saiu da grade.
 *
 * Presença, falta e licença já escritas ficam como estão: fato não se reescreve.
 * `soAvulsos` é para quando o horário fixo segue em outro lugar (a grade mudou
 * de dia ou hora, ou terminou junto com a vaga): aí só quem marcou aquela aula
 * em particular perdeu alguma coisa.
 */
export async function soltarDaSessao(
  db: Db, contaId: string, sessaoIds: string[], opcoes: { soAvulsos?: boolean } = {},
): Promise<number> {
  if (!sessaoIds.length) return 0
  let q = db.from('participacao')
    .update({ status: 'cancelada' })
    .eq('conta_id', contaId)
    .in('sessao_id', sessaoIds)
    .in('status', ['esperada', 'confirmada'])
  if (opcoes.soAvulsos) q = q.neq('origem', 'recorrente')
  const { data, error } = await q.select('id')
  if (error) throw error
  return data?.length ?? 0
}

/**
 * O contrário, ao reabrir a aula: quem saiu com crédito volta para a lista.
 * Quem já usou o crédito numa reposição fica de fora, senão teria duas aulas.
 */
export async function devolverASessao(db: Db, contaId: string, sessaoId: string): Promise<void> {
  const { data: soltas, error } = await db.from('participacao')
    .select('id').eq('conta_id', contaId).eq('sessao_id', sessaoId).eq('status', 'cancelada')
  if (error) throw error
  const ids = (soltas ?? []).map((p) => p.id)
  if (!ids.length) return

  const { data: usadas, error: erroUsadas } = await db.from('participacao')
    .select('reposicao_de_id').eq('conta_id', contaId).in('reposicao_de_id', ids)
  if (erroUsadas) throw erroUsadas
  const jaRepostas = new Set((usadas ?? []).map((u) => u.reposicao_de_id))
  const voltam = ids.filter((id) => !jaRepostas.has(id))
  if (!voltam.length) return

  const { error: erroVolta } = await db.from('participacao')
    .update({ status: 'esperada' }).in('id', voltam)
  if (erroVolta) throw erroVolta
}
