import type { Db } from '../supabase'
import { hojeEm, localDe } from '../agenda/fuso'
import { estadoDoPacote, type EstadoDoPacote } from '@/core/contratos/pacote'

/**
 * O pacote de aulas de cada pessoa, por modalidade, com o aviso que ele pede.
 *
 * Agrupado por pessoa e modalidade, e não por contrato: quem já renovou tem o
 * pacote velho esgotado **e** o novo cheio, ainda os dois ativos, e avisar
 * "esgotado" para quem acabou de pagar o próximo seria pendência falsa. Somar
 * os dois responde o que importa: quanto saldo essa pessoa tem nesta
 * modalidade.
 *
 * O consumido segue `contratosDaPessoa`: presença e falta gastam; aula
 * cancelada pelo estúdio não.
 */
export type PacoteDaPessoa = EstadoDoPacote & {
  pessoaId: string
  pessoaNome: string
  servico: string
}

const GASTAM = new Set(['presente', 'falta', 'falta_avisada'])
const AGENDADA = new Set(['esperada', 'confirmada'])

type Linha = {
  inicio: string
  sessoes_contratadas: number | null
  pessoa: { id: string; nome: string; ativo: boolean } | null
  plano: { servico_id: string; recorrencia: string; servico: { nome: string } | null } | null
  participacao: Array<{
    status: string
    sessao: { inicio: string; status: string } | null
  }>
}

export async function pacotesDaConta(
  db: Db, contaId: string, fuso: string, pessoaId?: string,
): Promise<PacoteDaPessoa[]> {
  let q = db
    .from('contrato')
    .select(`inicio, sessoes_contratadas,
             pessoa(id, nome, ativo),
             plano(servico_id, recorrencia, servico(nome)),
             participacao(status, sessao(inicio, status))`)
    .eq('conta_id', contaId)
    .eq('status', 'ativo')
  if (pessoaId) q = q.eq('pessoa_id', pessoaId)

  const { data, error } = await q.returns<Linha[]>()
  if (error) throw error

  const hoje = hojeEm(fuso)
  const agora = new Date().toISOString()

  const grupos = new Map<string, {
    pessoaId: string; pessoaNome: string; servico: string
    contratadas: number; usadas: number; temAgendada: boolean
    ultimoUso: string | null; inicio: string; soAvulsa: boolean
  }>()

  for (const c of data ?? []) {
    if (!c.pessoa?.ativo || !c.plano) continue
    // pacote tem a quantidade no contrato; avulsa é uma aula. Mensal e cia não
    // têm saldo: a grade fixa é que diz quando a pessoa vem
    const avulsa = c.plano.recorrencia === 'avulsa'
    const contratadas = c.sessoes_contratadas ?? (avulsa ? 1 : null)
    if (contratadas === null) continue
    // avulsa usada não é "pacote esgotado": o contrato de uma aula termina nela
    const usadasAqui = (c.participacao ?? []).filter((p) => GASTAM.has(p.status)).length
    if (avulsa && usadasAqui >= contratadas) continue
    const chave = `${c.pessoa.id}|${c.plano.servico_id}`
    const g = grupos.get(chave) ?? {
      pessoaId: c.pessoa.id,
      pessoaNome: c.pessoa.nome,
      servico: c.plano.servico?.nome ?? '',
      contratadas: 0, usadas: 0, temAgendada: false,
      ultimoUso: null, inicio: c.inicio, soAvulsa: true,
    }
    if (!avulsa) g.soAvulsa = false
    g.contratadas += contratadas
    if (c.inicio > g.inicio) g.inicio = c.inicio

    for (const p of c.participacao ?? []) {
      if (!p.sessao) continue
      if (GASTAM.has(p.status)) {
        g.usadas += 1
        const dia = localDe(p.sessao.inicio, fuso).data
        if (!g.ultimoUso || dia > g.ultimoUso) g.ultimoUso = dia
      } else if (AGENDADA.has(p.status) && p.sessao.status !== 'cancelada'
        && p.sessao.inicio > agora) {
        g.temAgendada = true
      }
    }
    grupos.set(chave, g)
  }

  return [...grupos.values()].map((g) => {
    const estado = estadoDoPacote({
      contratadas: g.contratadas,
      usadas: g.usadas,
      temAgendada: g.temAgendada,
      ultimoUso: g.ultimoUso,
      inicio: g.inicio,
      hoje,
    })
    // aula avulsa não "acaba": ou está por fazer, ou já tem dia marcado
    if (g.soAvulsa) estado.aviso = g.temAgendada ? null : 'parado'
    return { pessoaId: g.pessoaId, pessoaNome: g.pessoaNome, servico: g.servico, ...estado }
  })
}
