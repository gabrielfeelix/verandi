import type { Db } from '../supabase'
import { localDe } from '../agenda/fuso'

/** Mesma normalização que a coluna gerada `pessoa.nome_busca` faz no banco. */
export function semAcento(t: string): string {
  return t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

export type FiltroPessoa =
  | 'sem_telefone' | 'sem_horario_fixo' | 'plano_vencendo' | 'faltou_duas' | 'inativa'

export type PessoaLinha = {
  id: string
  nome: string
  telefone: string | null
  identificadorExterno: string | null
  vencimentoPlano: string | null
  ativo: boolean
  vagasAtivas: number
  faltasRecentes: number
  reposicoesAbertas: number
  ultimaPresenca: string | null
}

type LinhaResumo = {
  id: string
  nome: string
  telefone: string | null
  identificador_externo: string | null
  vencimento_plano: string | null
  ativo: boolean
  vagas_ativas: number
  faltas_recentes: number
  reposicoes_abertas: number
  ultima_presenca: string | null
}

const paraLinha = (l: LinhaResumo): PessoaLinha => ({
  id: l.id,
  nome: l.nome,
  telefone: l.telefone,
  identificadorExterno: l.identificador_externo,
  vencimentoPlano: l.vencimento_plano,
  ativo: l.ativo,
  vagasAtivas: Number(l.vagas_ativas),
  faltasRecentes: Number(l.faltas_recentes),
  reposicoesAbertas: Number(l.reposicoes_abertas),
  ultimaPresenca: l.ultima_presenca,
})

export async function listarPessoas(
  db: Db,
  contaId: string,
  opts: { busca?: string; filtros?: FiltroPessoa[] } = {},
): Promise<PessoaLinha[]> {
  const filtros = opts.filtros ?? []

  let q = db.from('pessoa_resumo').select('*').eq('conta_id', contaId)

  // inativa some do padrão e continua no histórico: quem parou em março
  // precisa continuar existindo no março
  q = filtros.includes('inativa') ? q.eq('ativo', false) : q.eq('ativo', true)

  if (opts.busca && opts.busca.trim()) {
    q = q.like('nome_busca', `%${semAcento(opts.busca.trim())}%`)
  }
  if (filtros.includes('sem_telefone')) q = q.is('telefone', null)
  if (filtros.includes('sem_horario_fixo')) q = q.eq('vagas_ativas', 0)
  if (filtros.includes('faltou_duas')) q = q.gte('faltas_recentes', 2)
  if (filtros.includes('plano_vencendo')) {
    const hoje = new Date()
    const limite = new Date(hoje.getTime() + 15 * 86_400_000)
    q = q.not('vencimento_plano', 'is', null)
         .lte('vencimento_plano', limite.toISOString().slice(0, 10))
  }

  const { data, error } = await q.order('nome').limit(300).returns<LinhaResumo[]>()
  if (error) throw error
  return (data ?? []).map(paraLinha)
}

export type VagaDaPessoa = {
  id: string
  serieId: string
  diaSemana: number
  horaInicio: string
  servico: string
  profissional: string | null
  inicio: string
  fim: string | null
}

export type ParticipacaoHistorico = {
  id: string
  sessaoId: string
  data: string
  hora: string
  servico: string
  origem: string
  status: string
  temReposicao: boolean
}

export type Ficha = {
  pessoa: PessoaLinha & {
    email: string | null
    nascimento: string | null
    observacao: string | null
  }
  tags: string[]
  vagas: VagaDaPessoa[]
  proximas: ParticipacaoHistorico[]
  historico: ParticipacaoHistorico[]
  reposicoesAbertas: ParticipacaoHistorico[]
}

export async function fichaDaPessoa(
  db: Db, contaId: string, pessoaId: string,
): Promise<Ficha | null> {
  const { data: p } = await db
    .from('pessoa_resumo').select('*')
    .eq('id', pessoaId).eq('conta_id', contaId)
    .maybeSingle<LinhaResumo & { email: string | null; nascimento: string | null;
                                 observacao: string | null }>()
  if (!p) return null

  const { data: contaRow } = await db
    .from('conta').select('fuso').eq('id', contaId).single()
  const fuso = (contaRow?.fuso as string) ?? 'America/Sao_Paulo'

  const { data: tags } = await db
    .from('pessoa_tag').select('tag').eq('pessoa_id', pessoaId)
    .returns<{ tag: string }[]>()

  const { data: vagas } = await db
    .from('vaga')
    .select(`
      id, inicio, fim, serie_id,
      serie:serie_id(dia_semana, hora_inicio, servico:servico_id(nome),
                     profissional:profissional_id(nome))
    `)
    .eq('pessoa_id', pessoaId)
    .returns<Array<{
      id: string; inicio: string; fim: string | null; serie_id: string
      serie: {
        dia_semana: number; hora_inicio: string
        servico: { nome: string } | null
        profissional: { nome: string } | null
      } | null
    }>>()

  const { data: participacoes } = await db
    .from('participacao')
    .select(`
      id, origem, status, sessao_id,
      sessao:sessao_id(inicio, servico:servico_id(nome)),
      reposicoes:participacao!reposicao_de_id(id)
    `)
    .eq('pessoa_id', pessoaId)
    .returns<Array<{
      id: string; origem: string; status: string; sessao_id: string
      sessao: { inicio: string; servico: { nome: string } | null } | null
      reposicoes: { id: string }[]
    }>>()

  const agora = new Date().toISOString()
  const todas: ParticipacaoHistorico[] = (participacoes ?? [])
    .filter((x) => x.sessao !== null)
    .map((x) => {
      const { data, hora } = localDe(x.sessao!.inicio, fuso)
      return {
        id: x.id,
        sessaoId: x.sessao_id,
        data, hora,
        servico: x.sessao!.servico?.nome ?? '—',
        origem: x.origem,
        status: x.status,
        temReposicao: (x.reposicoes ?? []).length > 0,
        _inicio: x.sessao!.inicio,
      } as ParticipacaoHistorico & { _inicio: string }
    })
    .sort((a, b) =>
      (b as ParticipacaoHistorico & { _inicio: string })._inicio.localeCompare(
        (a as ParticipacaoHistorico & { _inicio: string })._inicio))

  const futuras = todas.filter(
    (x) => (x as ParticipacaoHistorico & { _inicio: string })._inicio >= agora)

  return {
    pessoa: { ...paraLinha(p), email: p.email, nascimento: p.nascimento,
              observacao: p.observacao },
    tags: (tags ?? []).map((t) => t.tag),
    vagas: (vagas ?? []).filter((v) => v.serie !== null).map((v) => ({
      id: v.id,
      serieId: v.serie_id,
      diaSemana: v.serie!.dia_semana,
      horaInicio: String(v.serie!.hora_inicio).slice(0, 5),
      servico: v.serie!.servico?.nome ?? '—',
      profissional: v.serie!.profissional?.nome ?? null,
      inicio: v.inicio,
      fim: v.fim,
    })),
    proximas: futuras.slice().reverse(),
    historico: todas.filter(
      (x) => (x as ParticipacaoHistorico & { _inicio: string })._inicio < agora),
    // o `REP 05/6` da planilha, agora consultável
    reposicoesAbertas: todas.filter(
      (x) => (x.status === 'falta' || x.status === 'falta_avisada') && !x.temReposicao),
  }
}
