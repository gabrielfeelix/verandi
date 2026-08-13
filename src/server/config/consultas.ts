import type { Db } from '../supabase'

/**
 * O que a tela de Configuração precisa ler. Uma consulta por seção, porque a
 * tela carrega uma seção por vez.
 */

export type Padroes = {
  capacidadePadrao: number
  duracaoPadraoMin: number
  intervaloMin: number
  prazoReposicaoDias: number
  encaixeAcima: boolean
  creditoFaltaAvisada: boolean
  horariosSugeridos: string[]
}

export type ServicoLinha = {
  id: string
  nome: string
  duracaoMin: number
  capacidadePadrao: number
  ativo: boolean
  /** quantas séries vigentes usam este serviço — desativar sem saber é cego */
  emUso: number
}

export type LocalLinha = {
  id: string
  nome: string
  capacidade: number | null
  ativo: boolean
  emUso: number
}

export type DiaFuncionamento = {
  diaSemana: number
  abre: string | null
  fecha: string | null
}

export type DataFechada = {
  id: string
  data: string
  tipo: 'feriado' | 'fechado'
  descricao: string | null
  acao: 'cancelar_avisar' | 'so_marcar'
}

/** `HH:MM:SS` do Postgres vira `HH:MM` para a tela. */
function hhmm(hora: string): string {
  return hora.slice(0, 5)
}

export async function carregarPadroes(db: Db, contaId: string): Promise<Padroes> {
  const { data, error } = await db
    .from('conta')
    .select(`capacidade_padrao, duracao_padrao_min, intervalo_min,
             prazo_reposicao_dias, encaixe_acima, credito_falta_avisada,
             horarios_sugeridos`)
    .eq('id', contaId)
    .single<{
      capacidade_padrao: number
      duracao_padrao_min: number
      intervalo_min: number
      prazo_reposicao_dias: number
      encaixe_acima: boolean
      credito_falta_avisada: boolean
      horarios_sugeridos: string[]
    }>()

  if (error) throw error

  return {
    capacidadePadrao: data.capacidade_padrao,
    duracaoPadraoMin: data.duracao_padrao_min,
    intervaloMin: data.intervalo_min,
    prazoReposicaoDias: data.prazo_reposicao_dias,
    encaixeAcima: data.encaixe_acima,
    creditoFaltaAvisada: data.credito_falta_avisada,
    horariosSugeridos: (data.horarios_sugeridos ?? []).map(hhmm).sort(),
  }
}

export async function listarServicos(db: Db, contaId: string): Promise<ServicoLinha[]> {
  const { data, error } = await db
    .from('servico')
    .select('id, nome, duracao_min, capacidade_padrao, ativo, serie(id)')
    .eq('conta_id', contaId)
    .order('nome')
    .returns<{
      id: string; nome: string; duracao_min: number
      capacidade_padrao: number; ativo: boolean; serie: { id: string }[]
    }[]>()

  if (error) throw error

  return (data ?? []).map((s) => ({
    id: s.id,
    nome: s.nome,
    duracaoMin: s.duracao_min,
    capacidadePadrao: s.capacidade_padrao,
    ativo: s.ativo,
    emUso: s.serie.length,
  }))
}

export async function listarLocais(db: Db, contaId: string): Promise<LocalLinha[]> {
  const { data, error } = await db
    .from('local')
    .select('id, nome, capacidade, ativo, serie(id)')
    .eq('conta_id', contaId)
    .order('nome')
    .returns<{
      id: string; nome: string; capacidade: number | null
      ativo: boolean; serie: { id: string }[]
    }[]>()

  if (error) throw error

  return (data ?? []).map((l) => ({
    id: l.id,
    nome: l.nome,
    capacidade: l.capacidade,
    ativo: l.ativo,
    emUso: l.serie.length,
  }))
}

/**
 * Os sete dias, sempre.
 *
 * Dia sem linha é dia fechado — a tela mostra os sete e deixa o usuário abrir,
 * em vez de esconder o que não existe. "Cadê o domingo" é pergunta que não
 * deveria precisar ser feita.
 */
export async function carregarFuncionamento(
  db: Db, contaId: string,
): Promise<DiaFuncionamento[]> {
  const { data, error } = await db
    .from('funcionamento')
    .select('dia_semana, abre, fecha')
    .eq('conta_id', contaId)
    .returns<{ dia_semana: number; abre: string; fecha: string }[]>()

  if (error) throw error

  const porDia = new Map((data ?? []).map((f) => [f.dia_semana, f]))
  return [0, 1, 2, 3, 4, 5, 6].map((dia) => {
    const f = porDia.get(dia)
    return {
      diaSemana: dia,
      abre: f ? hhmm(f.abre) : null,
      fecha: f ? hhmm(f.fecha) : null,
    }
  })
}

export async function listarDatasFechadas(
  db: Db, contaId: string, de: string,
): Promise<DataFechada[]> {
  const { data, error } = await db
    .from('excecao_calendario')
    .select('id, data, tipo, descricao, acao')
    .eq('conta_id', contaId)
    .gte('data', de)
    .order('data')
    .returns<DataFechada[]>()

  if (error) throw error
  return data ?? []
}

export type ItemVocabulario = {
  chave: string
  singular: string
  plural: string
  /** o que o produto chama internamente, para a tela explicar o que se edita */
  padraoSingular: string
}
