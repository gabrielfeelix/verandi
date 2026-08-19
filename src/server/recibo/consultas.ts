import type { Db } from '../supabase'
import { instante } from '../agenda/fuso'
import type { CorpoDoRecibo, StatusRecibo } from '@/core/recibo/recibo'
import {
  resumoDeRecibos, type ResumoDeRecibos,
} from '@/core/financeiro/metricas'

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
  opcoes: {
    filtro?: FiltroRecibo
    busca?: string
    pagina?: number
    /** janela por data de **emissão**, que é o que se procura num arquivo */
    periodo?: { de: string; ate: string } | null
    /** o fuso da conta: sem ele a janela é lida em UTC. Ver `recortarRecibos` */
    fuso?: string
  } = {},
): Promise<{ linhas: ReciboLinha[]; total: number }> {
  const pagina = Math.max(1, opcoes.pagina ?? 1)
  const de = (pagina - 1) * POR_PAGINA

  const { data, error, count } = await recortarRecibos(
    db.from('recibo').select(SELECT_LINHA, { count: 'exact' }).eq('conta_id', contaId),
    opcoes,
  )
    .order('emitido_em', { ascending: false })
    .range(de, de + POR_PAGINA - 1)
    .returns<LinhaCrua[]>()
  if (error) throw error

  return { linhas: (data ?? []).map(paraLinha), total: count ?? 0 }
}

/**
 * O recorte do arquivo de recibos, aplicado à consulta.
 *
 * Compartilhado entre a lista e o resumo pelo mesmo motivo do financeiro: se a
 * faixa de números somasse por um caminho e a lista mostrasse por outro, os
 * dois discordariam em silêncio e o número de cima é o que alguém anota.
 *
 * **O período vai por `emitido_em`, e a janela é montada com o fuso da conta.**
 * `emitido_em` é `timestamptz`, e comparar com `'2026-01-19T00:00:00'` sem fuso
 * faz o Postgres ler no fuso do servidor, que é UTC: o recibo emitido às 21h30
 * no Brasil já é 00h30 do dia seguinte em UTC, e sumia do próprio dia. É a
 * armadilha que o fechamento pagou uma vez, chegando por outra porta — e desta
 * vez o teste pegou antes de alguém procurar um recibo e não achar.
 */
function recortarRecibos<T>(
  q: T,
  opcoes: {
    filtro?: FiltroRecibo
    busca?: string
    periodo?: { de: string; ate: string } | null
    fuso?: string
  },
): T {
  type Filtravel = {
    eq: (coluna: string, valor: unknown) => Filtravel
    gte: (coluna: string, valor: unknown) => Filtravel
    lt: (coluna: string, valor: unknown) => Filtravel
    ilike: (coluna: string, valor: string) => Filtravel
  }
  let f = q as Filtravel

  if (opcoes.filtro === 'validos') f = f.eq('status', 'valido')
  if (opcoes.filtro === 'cancelados') f = f.eq('status', 'cancelado')

  const busca = opcoes.busca?.trim()
  if (busca) {
    const numero = Number(busca.replace(/\D/g, ''))
    if (Number.isFinite(numero) && numero > 0 && /\d/.test(busca)) {
      f = f.eq('numero', numero)
    } else {
      // o nome mora dentro do `corpo`, e o `->>` é o que o PostgREST entende
      f = f.ilike('corpo->>pagadorNome', `%${busca}%`)
    }
  }

  if (opcoes.periodo) {
    const fuso = opcoes.fuso ?? 'America/Sao_Paulo'
    f = f.gte('emitido_em', instante(opcoes.periodo.de, '00:00', fuso))
      .lt('emitido_em', instante(diaSeguinte(opcoes.periodo.ate), '00:00', fuso))
  }

  return f as T
}

/** O dia seguinte, para a comparação exclusiva do fim da janela. */
function diaSeguinte(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

/** Teto do resumo, pelo mesmo motivo do financeiro: soma parcial se anuncia. */
export const TETO_DO_RESUMO_RECIBO = 20000

/**
 * Os números do arquivo: quantos, quanto, e quantos deixaram de valer.
 *
 * Somam o recorte inteiro, e não a página. Um arquivo de recibos que só diz
 * quantos existem não responde a pergunta de quem abre: "quanto foi
 * comprovado neste período?".
 */
export async function resumoDosRecibos(
  db: Db, contaId: string,
  opcoes: {
    filtro?: FiltroRecibo
    busca?: string
    periodo?: { de: string; ate: string } | null
    fuso?: string
  } = {},
): Promise<{ resumo: ResumoDeRecibos; completo: boolean }> {
  const { data, error } = await recortarRecibos(
    db.from('recibo').select('valor_cent, status').eq('conta_id', contaId),
    opcoes,
  )
    .limit(TETO_DO_RESUMO_RECIBO + 1)
    .returns<Array<{ valor_cent: number; status: string }>>()
  if (error) throw error

  const linhas = data ?? []
  return {
    resumo: resumoDeRecibos(
      linhas.slice(0, TETO_DO_RESUMO_RECIBO)
        .map((r) => ({ valorCent: r.valor_cent, status: r.status })),
    ),
    completo: linhas.length <= TETO_DO_RESUMO_RECIBO,
  }
}

/**
 * Os recibos de uma pessoa, para a ficha dela.
 *
 * A ficha mostrava o recibo pendurado na linha do pagamento, e só. Quem
 * pergunta "manda de novo aquele recibo de março" não tem por onde começar sem
 * abrir cobrança por cobrança.
 */
export async function recibosDaPessoa(
  db: Db, contaId: string, pessoaId: string, limite = 50,
): Promise<ReciboLinha[]> {
  const { data, error } = await db.from('recibo').select(SELECT_LINHA)
    .eq('conta_id', contaId).eq('pessoa_id', pessoaId)
    .order('emitido_em', { ascending: false })
    .limit(limite)
    .returns<LinhaCrua[]>()
  if (error) throw error
  return (data ?? []).map(paraLinha)
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
  db: Db, contaId: string, de: string, ate: string, fuso: string,
): Promise<{
  emitidos: number
  emitidoCent: number
  cancelados: number
  canceladoCent: number
}> {
  /*
   * O período vem em data local, e a coluna guarda instante absoluto.
   *
   * `${de}T00:00:00Z` é meia-noite em Londres, e no Brasil isso corta as três
   * últimas horas do dia: um recibo emitido às 21h30 de hoje nascia no dia
   * seguinte em UTC e sumia do fechamento de hoje. Apareceu rodando a suíte
   * inteira depois das 21h, e não rodando o teste sozinho de tarde.
   */
  const inicio = instante(de, '00:00', fuso)
  const fim = instante(ate, '23:59', fuso)

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


export type EnvioDoRecibo = { para: string; em: string }

/**
 * O último envio de cada recibo de uma lista.
 *
 * Responde "já mandei isso?", que é a pergunta de quem está com o aluno na
 * frente perguntando se o comprovante chegou. Uma consulta só para a página
 * inteira: uma por linha seria vinte idas ao banco para mostrar vinte frases
 * curtas.
 */
export async function ultimosEnvios(
  db: Db, contaId: string, reciboIds: string[],
): Promise<Map<string, EnvioDoRecibo>> {
  if (!reciboIds.length) return new Map()

  const { data, error } = await db.from('envio_de_recibo')
    .select('recibo_id, para, enviado_em')
    .eq('conta_id', contaId).in('recibo_id', reciboIds)
    .eq('entregue', true)
    .order('enviado_em', { ascending: false })
    .returns<Array<{ recibo_id: string; para: string; enviado_em: string }>>()
  if (error) throw error

  // a ordem é do mais novo para o mais velho, então o primeiro de cada id fica
  const mapa = new Map<string, EnvioDoRecibo>()
  for (const e of data ?? []) {
    if (mapa.has(e.recibo_id)) continue
    mapa.set(e.recibo_id, { para: e.para, em: e.enviado_em })
  }
  return mapa
}


/**
 * O e-mail da ficha de cada pagador, para a lista de recibos.
 *
 * O destino do envio é quem pagou, e a lista precisa saber disso antes de
 * abrir o modal: um modal que abre perguntando "para onde?" é o modal que pede
 * à recepção que digite de novo, toda vez, um dado que o sistema já tem.
 *
 * Uma consulta só para a página inteira. Não vem por junção no `select` do
 * recibo de propósito: o nome no papel sai do `corpo` congelado, e uma junção
 * com `pessoa` traria "Pessoa removida" para quem pediu exclusão, que é
 * exatamente o que este módulo evita.
 */
export async function emailsDosPagadores(
  db: Db, contaId: string, pessoaIds: Array<string | null>,
): Promise<Map<string, string>> {
  const ids = [...new Set(pessoaIds.filter((x): x is string => !!x))]
  if (!ids.length) return new Map()

  const { data, error } = await db.from('pessoa')
    .select('id, email').eq('conta_id', contaId).in('id', ids)
    .returns<Array<{ id: string; email: string | null }>>()
  if (error) throw error

  const mapa = new Map<string, string>()
  for (const p of data ?? []) {
    const email = p.email?.trim()
    if (email) mapa.set(p.id, email)
  }
  return mapa
}
