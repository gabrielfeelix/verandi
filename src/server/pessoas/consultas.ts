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
  /** o horário fixo em si — "Qua 09:00" —, não quantos são */
  horarioFixo: { diaSemana: number; hora: string } | null
  tags: string[]
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
  horarioFixo: null,
  tags: [],
})

/** Vinte por página, como manda o design system. */
export const POR_PAGINA = 20

export type OpcoesLista = {
  busca?: string
  filtros?: FiltroPessoa[]
  /** só quem tem esta etiqueta — é o chip "Gestante" da tela */
  tag?: string
  fuso?: string
  /** 1-indexada; sem ela vem a página 1 */
  pagina?: number
  /** sem paginar: é o que a exportação precisa, e só ela */
  tudo?: boolean
}

/**
 * Os filtros aplicados na consulta, num lugar só.
 *
 * Existe porque a contagem de cada chip roda exatamente a mesma pergunta que a
 * lista — e duas cópias da regra de "plano vencendo" acabariam discordando no
 * dia em que uma das duas mudasse.
 */
function aplicarFiltros<T extends { eq: unknown }>(
  consulta: T, opts: OpcoesLista,
): T {
  const filtros = opts.filtros ?? []
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let q: any = consulta

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
    // "daqui a 15 dias" no fuso da conta, não em UTC: às 21h em Brasília o
    // corte em UTC já é o dia seguinte, e o filtro passa a mentir por um dia
    const limite = new Date(Date.now() + 15 * 86_400_000).toISOString()
    q = q.not('vencimento_plano', 'is', null)
         .lte('vencimento_plano', localDe(limite, opts.fuso ?? 'UTC').data)
  }
  return q as T
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

export async function listarPessoas(
  db: Db,
  contaId: string,
  opts: OpcoesLista = {},
): Promise<{ linhas: PessoaLinha[]; total: number }> {
  /*
   * `count: 'exact'` porque a paginação precisa dizer "de 94", e não "de muitos".
   * Antes daqui havia um `.limit(300)` mudo: quem passasse de 300 cadastros
   * simplesmente sumia da tela, sem nada avisando — nem a pessoa, nem o log.
   */
  let q = aplicarFiltros(
    db.from('pessoa_resumo').select('*', { count: 'exact' }).eq('conta_id', contaId),
    opts,
  )

  // a etiqueta não está na view: filtra por id, com a lista de quem a tem
  if (opts.tag) {
    const ids = await idsComTag(db, contaId, opts.tag)
    if (ids.length === 0) return { linhas: [], total: 0 }
    q = q.in('id', ids)
  }

  q = q.order('nome')
  if (!opts.tudo) {
    const pagina = Math.max(1, opts.pagina ?? 1)
    const de = (pagina - 1) * POR_PAGINA
    q = q.range(de, de + POR_PAGINA - 1)
  }

  const { data, error, count } = await q.returns<LinhaResumo[]>()
  if (error) throw error

  const linhas = (data ?? []).map(paraLinha)
  await enriquecer(db, contaId, linhas)
  return { linhas, total: count ?? 0 }
}

async function idsComTag(db: Db, contaId: string, tag: string): Promise<string[]> {
  const { data } = await db
    .from('pessoa_tag').select('pessoa_id').eq('conta_id', contaId).eq('tag', tag)
    .returns<{ pessoa_id: string }[]>()
  return (data ?? []).map((t) => t.pessoa_id)
}

/**
 * O horário fixo e as etiquetas de cada linha da página.
 *
 * Duas consultas para os vinte ids da página, e não vinte consultas nem duas
 * colunas novas na view: a view já carrega quatro subconsultas correlacionadas,
 * e a quinta seria a que faz a lista de pessoas ficar lenta em conta grande.
 */
async function enriquecer(db: Db, contaId: string, linhas: PessoaLinha[]) {
  if (linhas.length === 0) return
  const ids = linhas.map((p) => p.id)
  const porId = new Map(linhas.map((p) => [p.id, p]))

  const hoje = new Date().toISOString().slice(0, 10)
  const [{ data: vagas }, { data: tags }] = await Promise.all([
    db.from('vaga')
      .select('pessoa_id, fim, serie:serie_id(dia_semana, hora_inicio)')
      .in('pessoa_id', ids)
      .or(`fim.is.null,fim.gte.${hoje}`)
      .returns<Array<{
        pessoa_id: string
        fim: string | null
        serie: { dia_semana: number; hora_inicio: string } | null
      }>>(),
    db.from('pessoa_tag')
      .select('pessoa_id, tag').eq('conta_id', contaId).in('pessoa_id', ids)
      .returns<{ pessoa_id: string; tag: string }[]>(),
  ])

  for (const v of vagas ?? []) {
    if (!v.serie) continue
    const p = porId.get(v.pessoa_id)
    if (!p) continue
    const candidato = {
      diaSemana: v.serie.dia_semana,
      hora: String(v.serie.hora_inicio).slice(0, 5),
    }
    // com dois horários fixos, mostra o primeiro da semana — o resto vira "+1"
    const atual = p.horarioFixo
    if (!atual
      || candidato.diaSemana < atual.diaSemana
      || (candidato.diaSemana === atual.diaSemana && candidato.hora < atual.hora)) {
      p.horarioFixo = candidato
    }
  }

  for (const t of tags ?? []) porId.get(t.pessoa_id)?.tags.push(t.tag)
}

/** Uma etiqueta da conta e quanta gente ativa a tem. */
export type EtiquetaContada = { tag: string; n: number }

/**
 * Quantos cabem em cada chip de filtro.
 *
 * O número no chip é o que transforma o filtro de "opção" em "aviso": ninguém
 * clica em "Sem telefone" por curiosidade, mas todo mundo repara em `5`.
 */
export async function contarPessoas(
  db: Db, contaId: string, opts: Pick<OpcoesLista, 'busca' | 'fuso'> = {},
): Promise<{
  ativos: number
  inativos: number
  porFiltro: Record<FiltroPessoa, number>
  etiquetas: EtiquetaContada[]
}> {
  const conta = async (filtros: FiltroPessoa[]) => {
    const { count } = await aplicarFiltros(
      db.from('pessoa_resumo')
        .select('id', { count: 'exact', head: true })
        .eq('conta_id', contaId),
      { ...opts, filtros },
    )
    return count ?? 0
  }

  const [ativos, semTelefone, semHorario, planoVencendo, faltouDuas, inativos] =
    await Promise.all([
      conta([]),
      conta(['sem_telefone']),
      conta(['sem_horario_fixo']),
      conta(['plano_vencendo']),
      conta(['faltou_duas']),
      conta(['inativa']),
    ])

  // as etiquetas são livres por conta: a lista de chips sai do que existe, e
  // não de uma lista fixa no código que envelheceria na primeira conta nova
  const { data: tags } = await db
    .from('pessoa_tag')
    .select('tag, pessoa:pessoa_id(ativo)')
    .eq('conta_id', contaId)
    .returns<{ tag: string; pessoa: { ativo: boolean } | null }[]>()

  const contagem = new Map<string, number>()
  for (const t of tags ?? []) {
    if (!t.pessoa?.ativo) continue
    contagem.set(t.tag, (contagem.get(t.tag) ?? 0) + 1)
  }

  return {
    ativos,
    inativos,
    porFiltro: {
      sem_telefone: semTelefone,
      sem_horario_fixo: semHorario,
      plano_vencendo: planoVencendo,
      faltou_duas: faltouDuas,
      inativa: inativos,
    },
    etiquetas: [...contagem.entries()]
      .map(([tag, n]) => ({ tag, n }))
      .sort((a, b) => b.n - a.n || a.tag.localeCompare(b.tag, 'pt-BR')),
  }
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
    /** desde quando existe: é o denominador de "veio 92% das vezes" */
    criadoEm: string
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
                                 observacao: string | null; criado_em: string }>()
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
              observacao: p.observacao, criadoEm: p.criado_em },
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
