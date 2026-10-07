import type { Db } from '../supabase'
import { hojeEm, localDe } from '../agenda/fuso'
import { aulasAFazerNoMes, estadoDoPacote, segundaDe, type EstadoDoPacote } from '@/core/contratos/pacote'

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
  const afastadas = await deLicenca(db, contaId)

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
    // de licença, ficar sem aula marcada é o combinado, não pendência
    if (estado.aviso === 'parado' && afastadas.has(g.pessoaId)) estado.aviso = null
    return { pessoaId: g.pessoaId, pessoaNome: g.pessoaNome, servico: g.servico, ...estado }
  })
}

/** Plano de N vezes por semana com aulas do mês ainda por marcar. */
export type AulasDoPlano = {
  pessoaId: string
  pessoaNome: string
  servico: string
  frequencia: number
  /** aulas que cabem até o fim do mês e não estão marcadas */
  restantes: number
}

type LinhaPlano = {
  pessoa_id: string
  inicio: string
  fim: string | null
  pessoa: { nome: string; ativo: boolean } | null
  plano: { servico_id: string; frequencia_semanal: number | null; recorrencia: string;
           servico: { nome: string } | null } | null
}

/**
 * A conta de `aulasAFazerNoMes` para cada pessoa com plano semanal.
 *
 * Licença aberta fica fora: a pessoa está afastada e as aulas esperam a volta.
 */
export async function aulasDoPlanoDaConta(
  db: Db, contaId: string, fuso: string, pessoaId?: string,
): Promise<AulasDoPlano[]> {
  let q = db.from('contrato')
    .select(`pessoa_id, inicio, fim, pessoa(nome, ativo),
             plano(servico_id, frequencia_semanal, recorrencia, servico(nome))`)
    .eq('conta_id', contaId).eq('status', 'ativo')
  if (pessoaId) q = q.eq('pessoa_id', pessoaId)
  const { data, error } = await q.returns<LinhaPlano[]>()
  if (error) throw error

  const afastadas = await deLicenca(db, contaId)
  const hoje = hojeEm(fuso)

  const planos = new Map<string, AulasDoPlano & { servicoId: string; fim: string | null }>()
  for (const c of data ?? []) {
    const pl = c.plano
    if (!c.pessoa?.ativo || !pl?.frequencia_semanal) continue
    if (pl.recorrencia === 'pacote' || pl.recorrencia === 'avulsa') continue
    if (afastadas.has(c.pessoa_id)) continue
    // contrato que ainda não começou ou já terminou não deve aula
    if (c.inicio > hoje || (c.fim && c.fim < hoje)) continue
    const chave = `${c.pessoa_id}|${pl.servico_id}`
    const g = planos.get(chave) ?? {
      pessoaId: c.pessoa_id, pessoaNome: c.pessoa.nome, servico: pl.servico?.nome ?? '',
      servicoId: pl.servico_id, frequencia: 0, restantes: 0, fim: c.fim,
    }
    g.frequencia += pl.frequencia_semanal
    // dois contratos na mesma modalidade: vale o que vai mais longe
    if (g.fim && (!c.fim || c.fim > g.fim)) g.fim = c.fim
    planos.set(chave, g)
  }
  if (!planos.size) return []

  const de = segundaDe(hoje)
  const pessoas = [...new Set([...planos.values()].map((p) => p.pessoaId))]
  // uma folga de um dia nas pontas cobre o fuso; a semana certa sai do dia local
  const { data: aulas, error: erroAulas } = await db.from('participacao')
    .select('pessoa_id, status, sessao!inner(inicio, servico_id, status)')
    .eq('conta_id', contaId)
    .in('pessoa_id', pessoas)
    .neq('status', 'cancelada')
    .gte('sessao.inicio', new Date(Date.parse(`${de}T00:00:00Z`) - 864e5).toISOString())
    .lte('sessao.inicio', new Date(Date.parse(`${hoje.slice(0, 7)}-01T00:00:00Z`) + 33 * 864e5).toISOString())
    .returns<Array<{ pessoa_id: string; status: string;
      sessao: { inicio: string; servico_id: string; status: string } }>>()
  if (erroAulas) throw erroAulas

  const porSemana = new Map<string, Map<string, number>>()
  for (const a of aulas ?? []) {
    if (a.sessao.status === 'cancelada') continue
    const chave = `${a.pessoa_id}|${a.sessao.servico_id}`
    const semana = segundaDe(localDe(a.sessao.inicio, fuso).data)
    const m = porSemana.get(chave) ?? new Map<string, number>()
    m.set(semana, (m.get(semana) ?? 0) + 1)
    porSemana.set(chave, m)
  }

  return [...planos.entries()]
    .map(([chave, p]) => ({
      pessoaId: p.pessoaId, pessoaNome: p.pessoaNome, servico: p.servico, frequencia: p.frequencia,
      restantes: aulasAFazerNoMes(p.frequencia, hoje, porSemana.get(chave) ?? new Map(), p.fim),
    }))
    .filter((p) => p.restantes > 0)
}

/** Quem está de licença agora: some das pendências de aula a marcar. */
async function deLicenca(db: Db, contaId: string): Promise<Set<string>> {
  const { data, error } = await db.from('licenca').select('pessoa_id')
    .eq('conta_id', contaId).is('encerrada_em', null)
  if (error) throw error
  return new Set((data ?? []).map((l) => l.pessoa_id))
}
