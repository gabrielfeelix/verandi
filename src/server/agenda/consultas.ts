import { calcularOcupacao, type Ocupacao, type StatusParticipacao } from '@/core/agenda/ocupacao'
import { estadoDaChamada, type EstadoChamada } from '@/core/agenda/chamada'
import type { Db } from '../supabase'
import { instante, localDe } from './fuso'
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
}

export type SessaoDetalhe = SessaoResumo & { participacoes: ParticipacaoDetalhe[] }

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
    servico: l.servico?.nome ?? '—',
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
  participacao: Array<{
    id: string
    status: StatusParticipacao
    origem: OrigemParticipacao
    reposicao_de_id: string | null
    observacao: string | null
    pessoa: { id: string; nome: string; telefone: string | null } | null
  }>
}

export async function sessaoDetalhe(db: Db, sessaoId: string): Promise<SessaoDetalhe | null> {
  const { data, error } = await db
    .from('sessao')
    .select(`
      id, conta_id, inicio, duracao_min, capacidade, status, motivo_cancelamento,
      profissional_id, local_id,
      servico:servico_id(nome),
      profissional:profissional_id(nome, cor),
      local:local_id(nome),
      participacao(
        id, status, origem, reposicao_de_id, observacao,
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
    }))
    // quem está na vaga fixa em cima, encaixe embaixo — é como a planilha
    // resolve por posição, e a leitura de relance depende disso
    .sort((a, b) => {
      if (a.origem === b.origem) return a.nome.localeCompare(b.nome, 'pt-BR')
      return a.origem === 'recorrente' ? -1 : b.origem === 'recorrente' ? 1 : 0
    })

  return { ...resumo, participacoes }
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
      servico: p.sessao!.servico?.nome ?? '—',
      status: p.status,
    }))
}
