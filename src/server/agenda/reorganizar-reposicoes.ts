import type { Db } from '../supabase'
import { filtroNaoRepoem, statusComCredito } from '@/core/agenda/ocupacao'

/**
 * A aula de reposição mais cedo paga a falta mais antiga.
 *
 * A ligação era decidida na hora de marcar: o bot e a recepção pegavam a falta
 * livre mais antiga **naquele momento**. Quem marcava primeiro a aula de
 * quarta e depois a de terça ficava com a terça pagando uma falta mais nova, e
 * as datas não batiam com a planilha do estúdio (Maria do Socorro e Luz
 * Marina, MGM, 09/out/2026). O Daniel confirmou a regra: na ordem das aulas.
 *
 * A fila de faltas é **toda falta que ainda gera crédito**, e não só as já
 * ligadas: quando a recepção marca como justificada uma falta mais antiga
 * depois de a reposição estar ligada, é essa a que a reposição paga, e a mais
 * nova volta para a lista (Erika, MGM, 13/out/2026: 06/08 marcada depois da
 * reposição de 08/10, que seguia pagando 31/08).
 *
 * Ficam de fora as reposições vindas da importação, cujo `REP dd/mm` é o que
 * o estúdio escreveu na planilha (e as faltas que elas pagam), e as que não
 * repõem (`naoRepoem`: a falta que daria crédito, cancelada, licença).
 *
 * Roda depois de toda escrita que mexe na ligação ou no status. Falhar aqui
 * não desfaz a marcação: a ordem fica como estava, e a próxima escrita tenta
 * de novo.
 */
export async function reorganizarReposicoes(
  db: Db, contaId: string, pessoaId: string,
): Promise<void> {
  try {
    const { data: conta } = await db.from('conta')
      .select('credito_falta, credito_falta_avisada').eq('id', contaId).single()

    const [{ data: pagam, error: e1 }, { data: faltas, error: e2 }] = await Promise.all([
      db.from('participacao')
        .select('id, reposicao_de_id, registrado_por_origem, sessao:sessao_id!inner(inicio)')
        .eq('conta_id', contaId).eq('pessoa_id', pessoaId)
        .not('reposicao_de_id', 'is', null)
        .not('status', 'in', filtroNaoRepoem(conta?.credito_falta_avisada ?? true, conta?.credito_falta ?? true)),
      db.from('participacao')
        .select('id, sessao:sessao_id!inner(inicio)')
        .eq('conta_id', contaId).eq('pessoa_id', pessoaId)
        .in('status', statusComCredito(true, conta?.credito_falta ?? true))
        .is('credito_encerrado_em', null)
        // a aula que é reposição de outra não é falta a pagar
        .is('reposicao_de_id', null),
    ])
    if (e1 || e2 || !pagam || !faltas) return

    const daImportacao = pagam.filter((r) => r.registrado_por_origem === 'importacao')
    const reposicoes = pagam
      .filter((r) => r.registrado_por_origem !== 'importacao')
      .sort((a, b) => a.sessao.inicio.localeCompare(b.sessao.inicio))
    if (!reposicoes.length) return

    const presasNaImportacao = new Set(daImportacao.map((r) => r.reposicao_de_id))
    const fila = faltas
      .filter((f) => !presasNaImportacao.has(f.id))
      .sort((a, b) => a.sessao.inicio.localeCompare(b.sessao.inicio))
    // menos faltas que reposições é dado que não fecha (crédito encerrado com
    // reposição ligada): mexer aí deixaria duas aulas pagando a mesma falta
    if (fila.length < reposicoes.length) return

    const trocas = reposicoes
      .map((r, i) => ({ id: r.id, de: r.reposicao_de_id, para: fila[i]?.id }))
      .filter((t): t is { id: string; de: string | null; para: string } => !!t.para && t.de !== t.para)
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
