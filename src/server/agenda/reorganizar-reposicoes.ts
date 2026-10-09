import type { Db } from '../supabase'

/**
 * A aula de reposição mais cedo paga a falta mais antiga.
 *
 * A ligação era decidida na hora de marcar: o bot e a recepção pegavam a falta
 * livre mais antiga **naquele momento**. Quem marcava primeiro a aula de
 * quarta e depois a de terça ficava com a terça pagando uma falta mais nova, e
 * as datas não batiam com a planilha do estúdio (Maria do Socorro e Luz
 * Marina, MGM, 09/out/2026). O Daniel confirmou a regra: na ordem das aulas.
 *
 * O conjunto de faltas usadas não muda: só a ordem de quem paga qual. Ficam de
 * fora as reposições vindas da importação, cujo `REP dd/mm` é o que o estúdio
 * escreveu na planilha, e as canceladas, que não usam crédito.
 *
 * Roda depois de toda escrita que mexe na ligação. Falhar aqui não desfaz a
 * marcação: a ordem fica como estava, e a próxima escrita tenta de novo.
 */
export async function reorganizarReposicoes(
  db: Db, contaId: string, pessoaId: string,
): Promise<void> {
  try {
    const { data, error } = await db
      .from('participacao')
      .select('id, reposicao_de_id, sessao:sessao_id!inner(inicio), falta:reposicao_de_id!inner(id, sessao:sessao_id!inner(inicio))')
      .eq('conta_id', contaId)
      .eq('pessoa_id', pessoaId)
      .not('reposicao_de_id', 'is', null)
      .neq('status', 'cancelada')
      .neq('registrado_por_origem', 'importacao')
    if (error || !data) return
    const ligadas = data.flatMap((r) => (r.falta ? [{ ...r, falta: r.falta }] : []))
    if (ligadas.length < 2) return

    const reposicoes = [...ligadas].sort((a, b) => a.sessao.inicio.localeCompare(b.sessao.inicio))
    const faltas = ligadas
      .map((r) => ({ id: r.reposicao_de_id!, inicio: r.falta.sessao.inicio }))
      .sort((a, b) => a.inicio.localeCompare(b.inicio))

    const trocas = reposicoes
      .map((r, i) => ({ id: r.id, de: r.reposicao_de_id, para: faltas[i].id }))
      .filter((t) => t.de !== t.para)
    if (!trocas.length) return

    // solta antes de religar: a mesma falta não pode estar em duas reposições
    // ao mesmo tempo, nem por um instante
    await db.from('participacao').update({ reposicao_de_id: null }).in('id', trocas.map((t) => t.id))
    for (const t of trocas) {
      await db.from('participacao').update({ reposicao_de_id: t.para }).eq('id', t.id)
    }
  } catch {
    // a marcação já foi feita; a ordem se acerta na próxima escrita
  }
}
