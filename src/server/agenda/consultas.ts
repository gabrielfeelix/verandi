import { calcularOcupacao, type Ocupacao, type StatusParticipacao } from '@/core/agenda/ocupacao'
import { estadoDaChamada, type EstadoChamada } from '@/core/agenda/chamada'
import type { Db } from '../supabase'
import { hojeEm, instante, localDe } from './fuso'
import { materializarJanela } from './materializar'

export type OrigemParticipacao =
  'recorrente' | 'avulso' | 'reposicao' | 'encaixe' | 'reserva'

export type SessaoResumo = {
  id: string
  inicio: string
  /** data e hora locais no fuso da conta, prontas para a tela */
  data: string
  hora: string
  duracaoMin: number
  servico: string
  profissionalId: string | null
  profissional: string | null
  /** a cor do profissional na grade: é ela que identifica quem dá a aula */
  corProfissional: string | null
  localId: string | null
  local: string | null
  status: 'prevista' | 'realizada' | 'cancelada'
  motivoCancelamento: string | null
  ocupacao: Ocupacao
  chamada: EstadoChamada
  /**
   * Quem está na turma, na ordem em que o banco devolveu.
   *
   * A lista existe porque a agenda do dia mostra os avatares empilhados: quem dá
   * a aula reconhece a turma pela cara das pessoas antes de ler o nome do
   * serviço.
   */
  pessoas: Array<{ nome: string; status: StatusParticipacao; tags: string[] }>
}

export type ParticipacaoDetalhe = {
  id: string
  pessoaId: string
  nome: string
  telefone: string | null
  tags: string[]
  origem: OrigemParticipacao
  status: StatusParticipacao
  reposicaoDeId: string | null
  observacao: string | null
  /**
   * A segunda linha da pessoa na chamada: **por que ela está aqui**.
   *
   * "vaga fixa desde março", "repõe a falta de 05/06 · Solo 07:00", "encaixe
   * feito por Recepção · hoje, 08:12". Sem ela, quatro nomes numa lista são
   * quatro nomes iguais — e a diferença entre quem tem lugar e quem entrou
   * hoje muda o que se faz quando falta.
   *
   * É frase montada de dado que existe (`vaga.inicio`, `reposicao_de_id`,
   * `registrado_em`); quando não há dado, é `null` e a linha não aparece.
   */
  detalhe: string | null
}

/** Uma linha do "Histórico da turma": quem entrou, como, e quando. */
export type EventoDaTurma = {
  texto: string
  quando: string
  tom: 'positivo' | 'atencao' | 'alerta' | 'info' | 'neutro'
}

export type SessaoDetalhe = SessaoResumo & {
  participacoes: ParticipacaoDetalhe[]
  historico: EventoDaTurma[]
}

const CAMPOS_RESUMO = `
  id, inicio, duracao_min, capacidade, status, motivo_cancelamento,
  profissional_id, local_id,
  servico:servico_id(nome),
  profissional:profissional_id(nome, cor),
  local:local_id(nome),
  participacao(status, pessoa:pessoa_id(nome, pessoa_tag(tag)))
`

type Embutido = { nome: string } | null
type LinhaResumo = {
  id: string
  inicio: string
  duracao_min: number
  capacidade: number
  status: 'prevista' | 'realizada' | 'cancelada'
  motivo_cancelamento: string | null
  profissional_id: string | null
  local_id: string | null
  servico: Embutido
  profissional: ({ nome: string; cor: string | null }) | null
  local: Embutido
  participacao: Array<{
    status: StatusParticipacao
    pessoa: { nome: string; pessoa_tag: { tag: string }[] } | null
  }>
}

function paraResumo(l: LinhaResumo, fuso: string): SessaoResumo {
  const status = l.participacao.map((p) => p.status)
  const { data, hora } = localDe(l.inicio, fuso)
  return {
    id: l.id,
    inicio: l.inicio,
    data,
    hora,
    duracaoMin: l.duracao_min,
    servico: l.servico?.nome ?? 'sem registro',
    profissionalId: l.profissional_id,
    profissional: l.profissional?.nome ?? null,
    corProfissional: l.profissional?.cor ?? null,
    localId: l.local_id,
    local: l.local?.nome ?? null,
    status: l.status,
    motivoCancelamento: l.motivo_cancelamento,
    ocupacao: calcularOcupacao(l.capacidade, status),
    chamada: estadoDaChamada(status),
    pessoas: l.participacao
      .filter((p) => p.pessoa !== null)
      .map((p) => ({
        nome: p.pessoa!.nome,
        status: p.status,
        tags: (p.pessoa!.pessoa_tag ?? []).map((t) => t.tag),
      })),
  }
}

async function fusoDa(db: Db, contaId: string): Promise<string> {
  const { data } = await db.from('conta').select('fuso').eq('id', contaId).single()
  return (data?.fuso as string) ?? 'America/Sao_Paulo'
}

/**
 * As sessões de um intervalo de datas locais, com ocupação e estado da chamada.
 *
 * **Materializa antes de ler.** Abrir a semana é o gatilho principal da
 * materialização sob demanda: quem olha, cria.
 */
export async function sessoesDoIntervalo(
  db: Db,
  contaId: string,
  de: string,
  ate: string,
  filtro: { profissionalId?: string; servicoId?: string; localId?: string } = {},
): Promise<SessaoResumo[]> {
  await materializarJanela(db, contaId, de, ate)
  const fuso = await fusoDa(db, contaId)

  let q = db
    .from('sessao')
    .select(CAMPOS_RESUMO)
    .eq('conta_id', contaId)
    .gte('inicio', instante(de, '00:00', fuso))
    .lte('inicio', instante(ate, '23:59', fuso))
    .order('inicio')

  if (filtro.profissionalId) q = q.eq('profissional_id', filtro.profissionalId)
  if (filtro.servicoId) q = q.eq('servico_id', filtro.servicoId)
  if (filtro.localId) q = q.eq('local_id', filtro.localId)

  const { data, error } = await q.returns<LinhaResumo[]>()
  if (error) throw error
  return (data ?? []).map((l) => paraResumo(l, fuso))
}

// não é interseção com `LinhaResumo` de propósito: `participacao` tem forma
// diferente aqui, e interseção de dois tipos de array vira um tipo que o
// TypeScript não consegue estreitar
type LinhaDetalhe = Omit<LinhaResumo, 'participacao'> & {
  conta_id: string
  serie_id: string | null
  criado_em: string
  serie: { dia_semana: number; hora_inicio: string } | null
  participacao: Array<{
    id: string
    status: StatusParticipacao
    origem: OrigemParticipacao
    reposicao_de_id: string | null
    observacao: string | null
    registrado_em: string
    registrado_por_origem: OrigemRegistro
    pessoa: { id: string; nome: string; telefone: string | null } | null
  }>
}

type OrigemRegistro = 'profissional' | 'recepcao' | 'bot' | 'sistema' | 'importacao'

const QUEM_REGISTROU: Record<OrigemRegistro, string | null> = {
  profissional: 'pelo profissional',
  recepcao: 'pela recepção',
  bot: 'pelo atendimento automático',
  importacao: 'na importação',
  // o padrão da coluna. "por Sistema" não informa nada e ainda soa como culpa
  // de ninguém — melhor calar e deixar só a data.
  sistema: null,
}

const DIAS_CURTOS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const MESES_CURTOS = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
]
const MESES_LONGOS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

/** "hoje, 08:12" · "ontem, 17:40" · "05 ago, 00:00" — relativo ao dia da conta. */
function quandoRelativo(iso: string, fuso: string, hoje: string): string {
  const { data, hora } = localDe(iso, fuso)
  if (data === hoje) return `hoje, ${hora}`

  const ontem = new Date(`${hoje}T12:00:00Z`)
  ontem.setUTCDate(ontem.getUTCDate() - 1)
  if (data === ontem.toISOString().slice(0, 10)) return `ontem, ${hora}`

  const [, m, d] = data.split('-')
  return `${d} ${MESES_CURTOS[Number(m) - 1]}, ${hora}`
}

/** "05/06" — a data curta que a planilha escrevia à mão no `REP 05/6`. */
function diaEMes(data: string): string {
  const [, m, d] = data.split('-')
  return `${d}/${m}`
}

export async function sessaoDetalhe(db: Db, sessaoId: string): Promise<SessaoDetalhe | null> {
  const { data, error } = await db
    .from('sessao')
    .select(`
      id, conta_id, serie_id, criado_em, inicio, duracao_min, capacidade,
      status, motivo_cancelamento, profissional_id, local_id,
      servico:servico_id(nome),
      profissional:profissional_id(nome, cor),
      local:local_id(nome),
      serie:serie_id(dia_semana, hora_inicio),
      participacao(
        id, status, origem, reposicao_de_id, observacao,
        registrado_em, registrado_por_origem,
        pessoa:pessoa_id(id, nome, telefone)
      )
    `)
    .eq('id', sessaoId)
    .maybeSingle<LinhaDetalhe>()

  if (error) throw error
  if (!data) return null

  const fuso = await fusoDa(db, data.conta_id)

  const { data: tags } = await db
    .from('pessoa_tag')
    .select('pessoa_id, tag')
    .in('pessoa_id', data.participacao.map((p) => p.pessoa?.id).filter(Boolean) as string[])
    .returns<{ pessoa_id: string; tag: string }[]>()

  const porPessoa = new Map<string, string[]>()
  for (const t of tags ?? []) {
    porPessoa.set(t.pessoa_id, [...(porPessoa.get(t.pessoa_id) ?? []), t.tag])
  }

  const resumo = paraResumo(
    {
      ...data,
      participacao: data.participacao.map((p) => ({
        status: p.status,
        pessoa: p.pessoa
          ? {
              nome: p.pessoa.nome,
              pessoa_tag: (porPessoa.get(p.pessoa.id) ?? []).map((tag) => ({ tag })),
            }
          : null,
      })),
    },
    fuso,
  )

  /*
   * Desde quando cada pessoa tem lugar fixo aqui.
   *
   * A vaga é da série, não da sessão: é por isso que a busca vai pela
   * `serie_id` da sessão e não pela sessão em si. Sessão avulsa não tem série,
   * e aí ninguém tem vaga fixa — o que é verdade, não falta de dado.
   */
  const desdeQuando = new Map<string, string>()
  if (data.serie_id) {
    const { data: vagas } = await db
      .from('vaga')
      .select('pessoa_id, inicio')
      .eq('serie_id', data.serie_id)
      .returns<{ pessoa_id: string; inicio: string }[]>()
    for (const v of vagas ?? []) {
      const anterior = desdeQuando.get(v.pessoa_id)
      // quem saiu e voltou tem duas vagas; a que interessa é a primeira
      if (!anterior || v.inicio < anterior) desdeQuando.set(v.pessoa_id, v.inicio)
    }
  }

  /* Qual falta cada reposição está pagando. */
  const reposicaoDe = new Map<string, { data: string; hora: string; servico: string }>()
  const idsRepostos = data.participacao
    .map((p) => p.reposicao_de_id)
    .filter((x): x is string => x !== null)
  if (idsRepostos.length) {
    const { data: origens } = await db
      .from('participacao')
      .select('id, sessao:sessao_id(inicio, servico:servico_id(nome))')
      .in('id', idsRepostos)
      .returns<{
        id: string
        sessao: { inicio: string; servico: { nome: string } | null } | null
      }[]>()
    for (const o of origens ?? []) {
      if (!o.sessao) continue
      const { data: d, hora } = localDe(o.sessao.inicio, fuso)
      reposicaoDe.set(o.id, { data: d, hora, servico: o.sessao.servico?.nome ?? 'sem registro' })
    }
  }

  const hoje = hojeEm(fuso)
  const anoDaSessao = resumo.data.slice(0, 4)

  function detalheDe(p: LinhaDetalhe['participacao'][number]): string | null {
    const quando = quandoRelativo(p.registrado_em, fuso, hoje)
    const quem = QUEM_REGISTROU[p.registrado_por_origem]

    if (p.origem === 'recorrente') {
      const desde = desdeQuando.get(p.pessoa!.id)
      if (!desde) return null
      const [ano, mes] = desde.split('-')
      const nomeDoMes = MESES_LONGOS[Number(mes) - 1]
      return ano === anoDaSessao
        ? `vaga fixa desde ${nomeDoMes}`
        : `vaga fixa desde ${nomeDoMes} de ${ano}`
    }

    if (p.origem === 'reposicao') {
      const falta = p.reposicao_de_id ? reposicaoDe.get(p.reposicao_de_id) : undefined
      return falta
        ? `repõe a falta de ${diaEMes(falta.data)} · ${falta.servico} ${falta.hora}`
        : `reposição · sem a falta apontada`
    }

    const verbo = p.origem === 'encaixe'
      ? 'encaixe feito'
      : p.origem === 'reserva'
        ? 'reserva feita'
        : 'marcado avulso'
    return quem ? `${verbo} ${quem} · ${quando}` : `${verbo} ${quando}`
  }

  const participacoes: ParticipacaoDetalhe[] = data.participacao
    .filter((p) => p.pessoa !== null)
    .map((p) => ({
      id: p.id,
      pessoaId: p.pessoa!.id,
      nome: p.pessoa!.nome,
      telefone: p.pessoa!.telefone,
      tags: porPessoa.get(p.pessoa!.id) ?? [],
      origem: p.origem,
      status: p.status,
      reposicaoDeId: p.reposicao_de_id,
      observacao: p.observacao,
      detalhe: [detalheDe(p), p.observacao].filter(Boolean).join(' · ') || null,
    }))
    // quem está na vaga fixa em cima, encaixe embaixo — é como a planilha
    // resolve por posição, e a leitura de relance depende disso
    .sort((a, b) => {
      if (a.origem === b.origem) return a.nome.localeCompare(b.nome, 'pt-BR')
      return a.origem === 'recorrente' ? -1 : b.origem === 'recorrente' ? 1 : 0
    })

  /*
   * O histórico da turma, montado do que o banco já guarda.
   *
   * Não é log de auditoria — mudança de presença não deixa rastro datado hoje.
   * É a pergunta que a chamada faz de verdade: **quem não estava aqui na
   * semana passada, e por quê**. Vaga fixa fica de fora porque toda a turma
   * entrou no mesmo instante em que a sessão foi materializada; quatro linhas
   * iguais não são histórico, são ruído.
   */
  const TOM_ORIGEM = {
    encaixe: 'alerta', reposicao: 'atencao', avulso: 'info',
    reserva: 'neutro', recorrente: 'positivo',
  } as const

  const historico: EventoDaTurma[] = data.participacao
    .filter((p) => p.pessoa !== null && p.origem !== 'recorrente')
    .sort((a, b) => (a.registrado_em < b.registrado_em ? 1 : -1))
    .map((p) => {
      const falta = p.reposicao_de_id ? reposicaoDe.get(p.reposicao_de_id) : undefined
      const quem = QUEM_REGISTROU[p.registrado_por_origem]
      const como = p.origem === 'reposicao'
        ? `entrou como reposição${falta ? ` de ${diaEMes(falta.data)}` : ''}`
        : p.origem === 'encaixe'
          ? 'entrou de encaixe'
          : p.origem === 'reserva'
            ? 'entrou como reserva'
            : 'entrou como avulso'
      return {
        texto: `${p.pessoa!.nome} ${como}${quem ? ` ${quem}` : ''}`,
        quando: quandoRelativo(p.registrado_em, fuso, hoje),
        tom: TOM_ORIGEM[p.origem],
      }
    })

  historico.push({
    texto: data.serie
      ? `Turma criada pela série ${DIAS_CURTOS[data.serie.dia_semana]} ${
          data.serie.hora_inicio.slice(0, 5)}`
      : 'Turma criada avulsa',
    quando: quandoRelativo(data.criado_em, fuso, hoje),
    tom: 'positivo',
  })

  return { ...resumo, participacoes, historico }
}

export type FaltaEmAberto = {
  participacaoId: string
  data: string
  servico: string
  status: StatusParticipacao
}

/**
 * As faltas desta pessoa que ainda geraram crédito e ninguém repôs.
 *
 * É o que o menu "apontar reposição" oferece: sem esta lista, quem repõe teria
 * que lembrar de cabeça qual falta está sendo paga — que é exatamente o que a
 * planilha fazia com `REP 05/6` escrito na célula.
 */
export async function faltasEmAberto(
  db: Db, contaId: string, pessoaId: string,
): Promise<FaltaEmAberto[]> {
  const { data, error } = await db
    .from('participacao')
    .select('id, status, sessao:sessao_id(inicio, servico:servico_id(nome))')
    .eq('conta_id', contaId)
    .eq('pessoa_id', pessoaId)
    .in('status', ['falta', 'falta_avisada'])
    .returns<{
      id: string
      status: StatusParticipacao
      sessao: { inicio: string; servico: { nome: string } | null } | null
    }[]>()
  if (error) throw error
  if (!data?.length) return []

  const { data: usadas } = await db
    .from('participacao')
    .select('reposicao_de_id')
    .eq('conta_id', contaId)
    .not('reposicao_de_id', 'is', null)
    .returns<{ reposicao_de_id: string }[]>()
  const jaReposta = new Set((usadas ?? []).map((u) => u.reposicao_de_id))

  return data
    .filter((p) => p.sessao && !jaReposta.has(p.id))
    .sort((a, b) => (a.sessao!.inicio < b.sessao!.inicio ? 1 : -1))
    .map((p) => ({
      participacaoId: p.id,
      data: p.sessao!.inicio.slice(0, 10),
      servico: p.sessao!.servico?.nome ?? 'sem registro',
      status: p.status,
    }))
}
