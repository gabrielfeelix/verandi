import type { Db } from '../supabase'
import type { EntidadeConfig } from '../log'

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
  /** quantas sessões futuras já materializadas dependem dele */
  sessoesFuturas: number
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
  const [{ data, error }, futuras] = await Promise.all([
    db.from('local')
      .select('id, nome, capacidade, ativo, serie(id, ativo)')
      .eq('conta_id', contaId)
      .order('nome')
      .returns<{
        id: string; nome: string; capacidade: number | null
        ativo: boolean; serie: { id: string; ativo: boolean }[]
      }[]>(),
    sessoesFuturasPor(db, contaId, 'local_id'),
  ])

  if (error) throw error

  return (data ?? []).map((l) => ({
    id: l.id,
    nome: l.nome,
    capacidade: l.capacidade,
    ativo: l.ativo,
    emUso: l.serie.filter((s) => s.ativo).length,
    sessoesFuturas: futuras.get(l.id) ?? 0,
  }))
}

/**
 * Quantas sessões futuras dependem de cada local ou de cada profissional.
 *
 * É o número que falta para a confirmação de desativar dizer o tamanho do
 * estrago: "38 horários fixos" não conta o que já está marcado na agenda das
 * próximas semanas, e é justamente isso que a recepção vai ter que remarcar.
 *
 * Uma consulta só, contada aqui, em vez de uma por item: são três ou quatro
 * locais, e `group by` pelo PostgREST custaria uma view para o mesmo resultado.
 * Só o que já foi materializado entra, que é o que existe de fato como sessão.
 */
export async function sessoesFuturasPor(
  db: Db, contaId: string, campo: 'local_id' | 'profissional_id',
): Promise<Map<string, number>> {
  const { data, error } = await db
    .from('sessao')
    .select(campo)
    .eq('conta_id', contaId)
    .eq('status', 'prevista')
    .gte('inicio', new Date().toISOString())
    .returns<Record<string, string | null>[]>()
  if (error) throw error

  const conta = new Map<string, number>()
  for (const linha of data ?? []) {
    const id = linha[campo]
    if (id) conta.set(id, (conta.get(id) ?? 0) + 1)
  }
  return conta
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

export type UltimaAlteracao = { quando: string; quem: string | null }

/**
 * Quem mexeu por último nesta parte da configuração, e quando.
 *
 * "Tudo salvo" sozinho responde à máquina; numa conta com quatro pessoas com
 * acesso, a pergunta real é **quem mudou o padrão**. Sai de `log_configuracao`,
 * que já grava toda edição — não é coluna nova nem estado duplicado.
 *
 * O nome vem do e-mail de acesso: é o único identificador que existe para
 * usuário do sistema, e é o mesmo que a seção Usuários mostra.
 */
export async function ultimaAlteracao(
  db: Db, contaId: string, entidade: EntidadeConfig,
): Promise<UltimaAlteracao | null> {
  const { data } = await db
    .from('log_configuracao')
    .select('em, por_usuario_id')
    .eq('conta_id', contaId)
    .eq('entidade', entidade)
    .order('em', { ascending: false })
    .limit(1)
    .maybeSingle<{ em: string; por_usuario_id: string | null }>()

  if (!data) return null

  let quem: string | null = null
  if (data.por_usuario_id) {
    const { data: usuarios } = await db.rpc('usuarios_da_conta', { p_conta: contaId })
    const lista = (usuarios ?? []) as unknown as { usuario_id: string; email: string }[]
    quem = lista.find((u) => u.usuario_id === data.por_usuario_id)?.email ?? null
  }

  return { quando: data.em, quem }
}
