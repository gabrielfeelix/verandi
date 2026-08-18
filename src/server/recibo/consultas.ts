import type { Db } from '../supabase'
import type { CorpoDoRecibo, StatusRecibo } from '@/core/recibo/recibo'

export const POR_PAGINA = 20

export type ReciboLinha = {
  id: string
  serie: string
  numero: number
  versao: number
  status: StatusRecibo
  valorCent: number
  emitidoEm: string
  canceladoEm: string | null
  motivo: string | null
  pessoaId: string | null
  pessoaNome: string
  corpo: CorpoDoRecibo
}

type LinhaCrua = {
  id: string
  serie: string
  numero: number
  versao: number
  status: string
  valor_cent: number
  emitido_em: string
  cancelado_em: string | null
  motivo: string | null
  pessoa_id: string | null
  corpo: CorpoDoRecibo
}

/*
 * O nome sai do `corpo`, e não de uma junção com `pessoa`.
 *
 * É a regra inteira deste módulo: o recibo diz o que foi impresso. Quem pediu
 * exclusão some da ficha e continua nomeado aqui, no documento contábil que a
 * lei manda guardar, e uma junção traria "Pessoa removida" para um papel que
 * está na mão de alguém dizendo outra coisa.
 */
const SELECT_LINHA = `
  id, serie, numero, versao, status, valor_cent, emitido_em, cancelado_em,
  motivo, pessoa_id, corpo
`

function paraLinha(r: LinhaCrua): ReciboLinha {
  return {
    id: r.id,
    serie: r.serie,
    numero: r.numero,
    versao: r.versao,
    status: r.status as StatusRecibo,
    valorCent: r.valor_cent,
    emitidoEm: r.emitido_em,
    canceladoEm: r.cancelado_em,
    motivo: r.motivo,
    pessoaId: r.pessoa_id,
    pessoaNome: r.corpo?.pagadorNome ?? '',
    corpo: r.corpo,
  }
}

export type FiltroRecibo = 'todos' | 'validos' | 'cancelados'

/**
 * Os recibos da conta, do mais novo para o mais velho.
 *
 * É o "deverá ser arquivado" do documento: o cliente arquiva em pasta de papel
 * porque não tinha onde guardar, e o que ele pede é conseguir achar depois. A
 * busca aceita o número e o nome de quem pagou.
 */
export async function listarRecibos(
  db: Db, contaId: string,
  opcoes: { filtro?: FiltroRecibo; busca?: string; pagina?: number } = {},
): Promise<{ linhas: ReciboLinha[]; total: number }> {
  const pagina = Math.max(1, opcoes.pagina ?? 1)
  const de = (pagina - 1) * POR_PAGINA

  let q = db.from('recibo').select(SELECT_LINHA, { count: 'exact' })
    .eq('conta_id', contaId)

  if (opcoes.filtro === 'validos') q = q.eq('status', 'valido')
  if (opcoes.filtro === 'cancelados') q = q.eq('status', 'cancelado')

  const busca = opcoes.busca?.trim()
  if (busca) {
    const numero = Number(busca.replace(/\D/g, ''))
    if (Number.isFinite(numero) && numero > 0) {
      q = q.eq('numero', numero)
    } else {
      // o nome mora dentro do `corpo`, e o `->>` é o que o PostgREST entende
      q = q.ilike('corpo->>pagadorNome', `%${busca}%`)
    }
  }

  const { data, error, count } = await q
    .order('emitido_em', { ascending: false })
    .range(de, de + POR_PAGINA - 1)
    .returns<LinhaCrua[]>()
  if (error) throw error

  return { linhas: (data ?? []).map(paraLinha), total: count ?? 0 }
}

/** Um recibo, para a folha impressa e para a segunda via. */
export async function reciboPorId(
  db: Db, contaId: string, id: string,
): Promise<ReciboLinha | null> {
  const { data, error } = await db.from('recibo').select(SELECT_LINHA)
    .eq('conta_id', contaId).eq('id', id).maybeSingle<LinhaCrua>()
  if (error) throw error
  return data ? paraLinha(data) : null
}

/** Os recibos de um pagamento: é o que a linha do financeiro precisa saber. */
export async function recibosDosPagamentos(
  db: Db, contaId: string, pagamentoIds: string[],
): Promise<Map<string, ReciboLinha>> {
  if (!pagamentoIds.length) return new Map()

  const { data, error } = await db.from('recibo')
    .select(`${SELECT_LINHA}, pagamento_id`)
    .eq('conta_id', contaId).in('pagamento_id', pagamentoIds)
    .neq('status', 'substituido')
    .returns<Array<LinhaCrua & { pagamento_id: string }>>()
  if (error) throw error

  const mapa = new Map<string, ReciboLinha>()
  for (const r of data ?? []) {
    // a versão mais alta é a que vale: a correção substitui a anterior
    const atual = mapa.get(r.pagamento_id)
    if (!atual || r.versao > atual.versao) mapa.set(r.pagamento_id, paraLinha(r))
  }
  return mapa
}

/**
 * Quantos recibos foram emitidos e quantos cancelados no período.
 *
 * É o terceiro relatório do item 4 do documento, e o último dos sete a ficar de
 * pé. Emitido conta pela emissão; cancelado conta pelo cancelamento, porque o
 * recibo de março cancelado em abril é um cancelamento de abril.
 */
export async function recibosDoPeriodo(
  db: Db, contaId: string, de: string, ate: string,
): Promise<{
  emitidos: number
  emitidoCent: number
  cancelados: number
  canceladoCent: number
}> {
  const inicio = `${de}T00:00:00Z`
  const fim = `${ate}T23:59:59Z`

  const [emitidos, cancelados] = await Promise.all([
    db.from('recibo').select('valor_cent')
      .eq('conta_id', contaId).neq('status', 'substituido')
      .gte('emitido_em', inicio).lte('emitido_em', fim)
      .returns<Array<{ valor_cent: number }>>(),
    db.from('recibo').select('valor_cent')
      .eq('conta_id', contaId).eq('status', 'cancelado')
      .gte('cancelado_em', inicio).lte('cancelado_em', fim)
      .returns<Array<{ valor_cent: number }>>(),
  ])

  return {
    emitidos: (emitidos.data ?? []).length,
    emitidoCent: (emitidos.data ?? []).reduce((s, r) => s + r.valor_cent, 0),
    cancelados: (cancelados.data ?? []).length,
    canceladoCent: (cancelados.data ?? []).reduce((s, r) => s + r.valor_cent, 0),
  }
}
