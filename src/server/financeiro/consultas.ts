import type { Db } from '../supabase'
import type { Recorrencia } from '@/core/planos/plano'
import { instante } from '../agenda/fuso'
import { fimProrrogado, type Pausa } from '@/core/contratos/contrato'
import {
  cobrancasPrevistas, competenciaDe, fimDaCompetencia, proximaCompetencia,
  situacaoDaCobranca, diasDeAtraso, type SituacaoCobranca,
} from '@/core/financeiro/cobranca'
import type {
  CobrancaDoPeriodo, ContratoDoPeriodo, EstornoDoPeriodo, Forma,
  PagamentoRecebido, PessoaDaConta,
} from '@/core/financeiro/fechamento'
import { descricaoDoRecibo, type StatusRecibo } from '@/core/recibo/recibo'
import {
  resumoDeCobrancas, type ResumoDeCobrancas,
} from '@/core/financeiro/metricas'

export const POR_PAGINA = 20

export type PagamentoLinha = {
  id: string
  valorCent: number
  forma: Forma
  recebidoEm: string
  observacao: string | null
  estornado: boolean
  motivoEstorno: string | null
  /** o recibo já emitido deste pagamento, quando existe */
  recibo: { id: string; descricao: string; cancelado: boolean } | null
}

export type CobrancaLinha = {
  id: string
  pessoaId: string
  pessoaNome: string
  telefone: string | null
  contratoId: string
  planoNome: string
  servicoNome: string
  competencia: string
  vencimento: string
  valorCent: number
  valorPagoCent: number
  situacao: SituacaoCobranca
  diasDeAtraso: number
  motivoCancelamento: string | null
  formaSugerida: Forma | null
  pagamentos: PagamentoLinha[]
}

type LinhaCrua = {
  id: string
  contrato_id: string
  pessoa_id: string
  competencia: string
  vencimento: string
  valor_cent: number
  valor_pago_cent: number
  situacao: string
  motivo_cancelamento: string | null
  pessoa: { nome: string; telefone: string | null } | null
  contrato: {
    forma_pagamento: string | null
    plano: { nome: string; servico: { nome: string } | null } | null
  } | null
  pagamento: Array<{
    id: string
    valor_cent: number
    forma: string
    recebido_em: string
    observacao: string | null
    estornado_em: string | null
    motivo_estorno: string | null
  }>
}

/*
 * A lista de colunas em **uma string literal**, e não somada com `+`: o
 * supabase-js lê o `select` como tipo literal para saber a forma da resposta, e
 * concatenação vira `string` e devolve `GenericStringError`. Ver
 * `materializarJanela`.
 */
const SELECT_LINHA = `
  id, contrato_id, pessoa_id, competencia, vencimento, valor_cent,
  valor_pago_cent, situacao, motivo_cancelamento,
  pessoa(nome, telefone),
  contrato(forma_pagamento, plano(nome, servico(nome))),
  pagamento(id, valor_cent, forma, recebido_em, observacao,
            estornado_em, motivo_estorno)
`

function paraLinha(c: LinhaCrua, hoje: string): CobrancaLinha {
  return {
    id: c.id,
    pessoaId: c.pessoa_id,
    pessoaNome: c.pessoa?.nome ?? '',
    telefone: c.pessoa?.telefone ?? null,
    contratoId: c.contrato_id,
    planoNome: c.contrato?.plano?.nome ?? '',
    servicoNome: c.contrato?.plano?.servico?.nome ?? '',
    competencia: c.competencia,
    vencimento: c.vencimento,
    valorCent: c.valor_cent,
    valorPagoCent: c.valor_pago_cent,
    situacao: situacaoDaCobranca(c, hoje),
    diasDeAtraso: diasDeAtraso(c.vencimento, hoje),
    motivoCancelamento: c.motivo_cancelamento,
    // a forma que o contrato diz é a que o modal já vem preenchendo: quem paga
    // no pix desde março vai pagar no pix de novo
    formaSugerida: (c.contrato?.forma_pagamento as Forma) ?? null,
    pagamentos: (c.pagamento ?? []).map((p) => ({
      id: p.id,
      valorCent: p.valor_cent,
      forma: p.forma as Forma,
      recebidoEm: p.recebido_em,
      observacao: p.observacao,
      estornado: p.estornado_em !== null,
      motivoEstorno: p.motivo_estorno,
      recibo: null,
    })).sort((a, b) => a.recebidoEm.localeCompare(b.recebidoEm)),
  }
}

export type FiltroCobranca =
  'todas' | 'atrasadas' | 'a_vencer' | 'pagas' | 'canceladas'

export type RecorteDeCobranca = {
  filtro: FiltroCobranca
  /** janela por **vencimento**; a tela diz isso com todas as letras */
  periodo?: { de: string; ate: string } | null
  /** ids de pessoa, quando a busca por nome já resolveu quem */
  pessoaIds?: string[] | null
}

/**
 * Um recorte, aplicado à consulta.
 *
 * Escrito uma vez e usado duas: pela lista paginada e pelo resumo que soma o
 * conjunto inteiro. Se a lista e a soma filtrassem por caminhos diferentes, a
 * faixa de números diria uma coisa e as linhas embaixo dela diriam outra, que é
 * o tipo de divergência que ninguém percebe e todo mundo acredita.
 *
 * O tipo do construtor do PostgREST muda a cada filtro encadeado, e não há como
 * nomeá-lo aqui sem arrastar meia biblioteca para a assinatura. Então ele entra
 * genérico e sai genérico, com uma conversão só, no meio, onde ela se lê.
 */
function recortar<T>(q: T, r: RecorteDeCobranca, hoje: string): T {
  type Filtravel = {
    eq: (coluna: string, valor: unknown) => Filtravel
    in: (coluna: string, valores: unknown[]) => Filtravel
    lt: (coluna: string, valor: unknown) => Filtravel
    lte: (coluna: string, valor: unknown) => Filtravel
    gte: (coluna: string, valor: unknown) => Filtravel
  }
  let f = q as Filtravel

  if (r.filtro === 'canceladas') f = f.eq('situacao', 'cancelada')
  else if (r.filtro === 'pagas') f = f.eq('situacao', 'paga')
  else if (r.filtro === 'atrasadas') {
    f = f.in('situacao', ['aberta', 'parcial']).lt('vencimento', hoje)
  } else if (r.filtro === 'a_vencer') {
    f = f.in('situacao', ['aberta', 'parcial']).gte('vencimento', hoje)
  }
  /*
   * 'todas' não recorta situação nenhuma. É a aba que responde "o que houve com
   * esta pessoa" sem obrigar quem pergunta a visitar quatro abas e somar de
   * cabeça o que viu em cada uma.
   */

  if (r.periodo) {
    f = f.gte('vencimento', r.periodo.de).lte('vencimento', r.periodo.ate)
  }
  if (r.pessoaIds) f = f.in('pessoa_id', r.pessoaIds)

  return f as T
}

/**
 * Quem casa com a busca por nome, resolvido antes da consulta principal.
 *
 * `ilike` em coluna de tabela ligada não filtra a de cima no PostgREST, e
 * trazer tudo para filtrar em memória pagina errado — o defeito que ninguém
 * percebe até a lista passar de vinte linhas.
 *
 * Devolve `null` quando não há busca, e lista vazia quando a busca não achou
 * ninguém. São coisas diferentes: `null` é "não filtre", `[]` é "não há".
 */
async function idsQueCasam(
  db: Db, contaId: string, busca: string | undefined,
): Promise<string[] | null> {
  const termo = busca?.trim()
  if (!termo) return null
  const { data } = await db.from('pessoa')
    .select('id').eq('conta_id', contaId)
    .ilike('nome', `%${termo}%`).limit(500)
  return (data ?? []).map((p) => p.id)
}

/**
 * As cobranças de uma aba, paginadas.
 *
 * A ordem é a do que dói primeiro: em atraso, o mais velho na frente; a vencer,
 * o mais próximo na frente; paga, a mais recente. A recepção não pede
 * ordenação, ela pede a próxima ligação.
 */
export async function listarCobrancas(
  db: Db, contaId: string, hoje: string,
  opcoes: {
    filtro: FiltroCobranca
    busca?: string
    pagina?: number
    periodo?: { de: string; ate: string } | null
  },
): Promise<{ linhas: CobrancaLinha[]; total: number }> {
  const pagina = Math.max(1, opcoes.pagina ?? 1)
  const de = (pagina - 1) * POR_PAGINA

  const pessoaIds = await idsQueCasam(db, contaId, opcoes.busca)
  if (pessoaIds?.length === 0) return { linhas: [], total: 0 }

  const base = db.from('cobranca_resumo')
    .select(SELECT_LINHA, { count: 'exact' }).eq('conta_id', contaId)

  const recortada = recortar(base, {
    filtro: opcoes.filtro, periodo: opcoes.periodo, pessoaIds,
  }, hoje)

  /*
   * A ordem é a do que dói primeiro: em atraso, o mais velho na frente; a
   * vencer, o mais próximo na frente; o resto, o mais recente. A recepção não
   * pede ordenação, ela pede a próxima ligação.
   */
  const crescente = opcoes.filtro === 'atrasadas' || opcoes.filtro === 'a_vencer'

  const { data, error, count } = await recortada
    .order('vencimento', { ascending: crescente })
    .range(de, de + POR_PAGINA - 1)
    .returns<LinhaCrua[]>()
  if (error) throw error

  const linhas = (data ?? []).map((c) => paraLinha(c, hoje))
  await juntarRecibos(db, contaId, linhas)
  return { linhas, total: count ?? 0 }
}

/**
 * Os números da faixa: o conjunto inteiro do recorte, e não a página.
 *
 * A tela dizia "10 cobranças em atraso" e não dizia quanto. Somar só a página
 * seria pior que não somar: o número mudaria ao virar a página, e quem confere
 * caixa com um número que anda sozinho perde a tarde.
 *
 * Traz duas colunas por linha, e nada mais. **Tem teto**, e o teto está dito na
 * resposta: acima dele a soma sairia cara e passaria a ser parcial em silêncio,
 * e a tela precisa poder avisar em vez de mentir. No tamanho real de um estúdio
 * — algumas centenas de cobranças por ano — ele nunca é alcançado.
 */
export const TETO_DO_RESUMO = 20000

export async function resumoDasCobrancas(
  db: Db, contaId: string, hoje: string,
  opcoes: {
    filtro: FiltroCobranca
    busca?: string
    periodo?: { de: string; ate: string } | null
  },
): Promise<{ resumo: ResumoDeCobrancas; completo: boolean }> {
  const pessoaIds = await idsQueCasam(db, contaId, opcoes.busca)
  if (pessoaIds?.length === 0) {
    return { resumo: resumoDeCobrancas([]), completo: true }
  }

  const base = db.from('cobranca_resumo')
    .select('valor_cent, valor_pago_cent, situacao').eq('conta_id', contaId)

  const { data, error } = await recortar(base, {
    filtro: opcoes.filtro, periodo: opcoes.periodo, pessoaIds,
  }, hoje)
    .limit(TETO_DO_RESUMO + 1)
    .returns<Array<{ valor_cent: number; valor_pago_cent: number; situacao: string }>>()
  if (error) throw error

  const linhas = data ?? []
  const completo = linhas.length <= TETO_DO_RESUMO
  return {
    resumo: resumoDeCobrancas(linhas.slice(0, TETO_DO_RESUMO).map((c) => ({
      valorCent: c.valor_cent,
      valorPagoCent: c.valor_pago_cent,
      situacao: c.situacao,
    }))),
    completo,
  }
}

/**
 * Cola em cada pagamento o recibo dele, numa consulta só.
 *
 * Numa junção dentro do `select` da cobrança, o recibo viria com o corpo
 * inteiro por linha, que é o objeto mais pesado deste módulo, e a lista carrega
 * vinte cobranças de uma vez. Aqui vai só o que a linha precisa mostrar: se já
 * existe papel, e qual é o número dele.
 */
async function juntarRecibos(
  db: Db, contaId: string, linhas: CobrancaLinha[],
): Promise<void> {
  const ids = linhas.flatMap((c) => c.pagamentos.map((p) => p.id))
  if (!ids.length) return

  const { data } = await db.from('recibo')
    .select('id, serie, numero, versao, status, pagamento_id')
    .eq('conta_id', contaId).in('pagamento_id', ids)
    .neq('status', 'substituido')
    .returns<Array<{
      id: string; serie: string; numero: number; versao: number
      status: string; pagamento_id: string
    }>>()

  const porPagamento = new Map<string, typeof data extends null ? never : NonNullable<typeof data>[number]>()
  for (const r of data ?? []) {
    const atual = porPagamento.get(r.pagamento_id)
    if (!atual || r.versao > atual.versao) porPagamento.set(r.pagamento_id, r)
  }

  for (const c of linhas) {
    for (const p of c.pagamentos) {
      const r = porPagamento.get(p.id)
      p.recibo = r
        ? {
            id: r.id,
            descricao: descricaoDoRecibo({
              serie: r.serie, numero: r.numero, versao: r.versao,
              status: r.status as StatusRecibo,
            }),
            cancelado: r.status === 'cancelado',
          }
        : null
    }
  }
}

/** Quantas estão em atraso hoje: é o número do rail, e ele precisa ser barato. */
export async function contarAtrasadas(
  db: Db, contaId: string, hoje: string,
): Promise<number> {
  const { count } = await db.from('cobranca_resumo')
    .select('id', { count: 'exact', head: true })
    .eq('conta_id', contaId).in('situacao', ['aberta', 'parcial'])
    .lt('vencimento', hoje)
  return count ?? 0
}

/**
 * O caixa em três números, para o bloco da tela inicial.
 *
 * Uma consulta só, sem paginação e sem corpo de linha: quem abre o dia quer
 * saber se tem alguém para ligar e quanto entra esta semana, e trazer a lista
 * inteira para somar na memória custaria a tela toda por um número que cabe
 * numa frase.
 *
 * O que está vencido hoje entra em `atrasadoCent`; o que vence de hoje até a
 * data limite entra em `aVencerCent`. Os dois usam o valor **que falta**, e não
 * o da cobrança: quem já pagou metade deve metade, e o número que interessa é o
 * que ainda tem de entrar.
 */
export async function resumoDoCaixa(
  db: Db, contaId: string, hoje: string, ate: string,
): Promise<{
  atrasadas: number
  atrasadoCent: number
  aVencer: number
  aVencerCent: number
}> {
  const { data, error } = await db.from('cobranca_resumo')
    .select('vencimento, valor_cent, valor_pago_cent')
    .eq('conta_id', contaId).in('situacao', ['aberta', 'parcial'])
    .lte('vencimento', ate)
    .returns<Array<{
      vencimento: string | null
      valor_cent: number | null
      valor_pago_cent: number | null
    }>>()
  if (error) throw error

  let atrasadas = 0; let atrasadoCent = 0
  let aVencer = 0; let aVencerCent = 0
  for (const c of data ?? []) {
    if (!c.vencimento) continue
    const falta = Math.max(0, (c.valor_cent ?? 0) - (c.valor_pago_cent ?? 0))
    if (falta === 0) continue
    if (c.vencimento < hoje) { atrasadas++; atrasadoCent += falta }
    else { aVencer++; aVencerCent += falta }
  }
  return { atrasadas, atrasadoCent, aVencer, aVencerCent }
}

/** As cobranças de uma pessoa, da mais nova para a mais velha. */
export async function cobrancasDaPessoa(
  db: Db, contaId: string, pessoaId: string, hoje: string,
): Promise<CobrancaLinha[]> {
  const { data, error } = await db.from('cobranca_resumo').select(SELECT_LINHA)
    .eq('conta_id', contaId).eq('pessoa_id', pessoaId)
    .order('competencia', { ascending: false })
    .returns<LinhaCrua[]>()
  if (error) throw error
  const linhas = (data ?? []).map((c) => paraLinha(c, hoje))
  await juntarRecibos(db, contaId, linhas)
  return linhas
}

export type Fechamento = {
  de: string
  ate: string
  pagamentos: PagamentoRecebido[]
  cobrancas: CobrancaDoPeriodo[]
  /**
   * O atraso é de **hoje**, e não do período.
   *
   * Quem deve desde junho é exatamente quem se liga hoje, e um fechamento de
   * agosto que esconde essa pessoa transforma a lista de ligação numa lista
   * incompleta, que é pior do que não ter lista. O período fecha o que entrou;
   * o atraso é uma pergunta sobre agora.
   */
  atrasadas: CobrancaDoPeriodo[]
  /** o que voltou atrás no período, que é o quarto relatório do documento */
  estornos: EstornoDoPeriodo[]
  /** as fichas da conta, para contar cliente ativo, inativo e novo */
  pessoas: PessoaDaConta[]
  contratos: ContratoDoPeriodo[]
  /** o que os contratos em vigor vão gerar no mês seguinte ao período */
  previstoCent: number
}

/**
 * O material bruto das sete perguntas, numa ida ao banco por assunto.
 *
 * As somas moram em `core/financeiro/fechamento.ts`, e aqui só se busca: assim
 * a tela e a planilha usam os mesmos números sem repetir uma linha de conta, e
 * o teste das somas não precisa de banco.
 */
export async function materialDoFechamento(
  db: Db, contaId: string, de: string, ate: string, hoje: string, fuso: string,
): Promise<Fechamento> {
  const [pagamentos, cobrancas, contratos, atrasadas, estornos, pessoas] =
    await Promise.all([
    db.from('pagamento')
      .select(`valor_cent, forma, recebido_em,
               cobranca(contrato(plano(nome, servico(nome))))`)
      .eq('conta_id', contaId).is('estornado_em', null)
      .gte('recebido_em', de).lte('recebido_em', ate)
      .returns<Array<{
        valor_cent: number; forma: string; recebido_em: string
        cobranca: {
          contrato: { plano: { nome: string; servico: { nome: string } | null } | null } | null
        } | null
      }>>(),
    db.from('cobranca_resumo')
      .select(`id, pessoa_id, competencia, vencimento, valor_cent,
               valor_pago_cent, situacao, pessoa(nome, telefone)`)
      /*
       * As cobranças vão até o fim do mês, e não até `ate`.
       *
       * "Quanto ainda vai vencer" com a janela terminando hoje é sempre zero,
       * porque o que vence amanhã está fora dela. O período fecha o que
       * **entrou**; o que está por vir precisa enxergar o resto do mês, senão o
       * número existe e não responde nada.
       */
      .eq('conta_id', contaId).gte('vencimento', de)
      .lte('vencimento', fimDaCompetencia(competenciaDe(ate)))
      .returns<Array<{
        id: string; pessoa_id: string; competencia: string; vencimento: string
        valor_cent: number; valor_pago_cent: number; situacao: string
        pessoa: { nome: string; telefone: string | null } | null
      }>>(),
    db.from('contrato')
      .select(`inicio, fim, status, preco_aplicado_cent, vinculo_usado,
               dia_vencimento, pausa(inicio, fim),
               plano(recorrencia, parcelas, preco_avulso_cent, preco_vinculado_cent)`)
      .eq('conta_id', contaId)
      .returns<Array<{
        inicio: string; fim: string | null; status: string
        preco_aplicado_cent: number; vinculo_usado: boolean
        dia_vencimento: number | null
        pausa: Array<{ inicio: string; fim: string | null }>
        plano: {
          recorrencia: string; parcelas: number
          preco_avulso_cent: number; preco_vinculado_cent: number
        } | null
      }>>(),
    db.from('cobranca_resumo')
      .select(`id, pessoa_id, competencia, vencimento, valor_cent,
               valor_pago_cent, situacao, pessoa(nome, telefone)`)
      .eq('conta_id', contaId).in('situacao', ['aberta', 'parcial'])
      .lt('vencimento', hoje)
      .returns<Array<{
        id: string; pessoa_id: string; competencia: string; vencimento: string
        valor_cent: number; valor_pago_cent: number; situacao: string
        pessoa: { nome: string; telefone: string | null } | null
      }>>(),
    /*
     * O estorno é filtrado por `estornado_em`, e não por `recebido_em`: o
     * dinheiro entrou em março e voltou em abril, e quem fecha abril precisa
     * ver a devolução em abril. Somar pelo recebimento esconderia o estorno no
     * mês que já foi conferido.
     */
    db.from('pagamento')
      .select('valor_cent, estornado_em, motivo_estorno, cobranca(pessoa(nome))')
      /*
       * Em instante absoluto, e no fuso da conta: `${de}T00:00:00Z` é
       * meia-noite em Londres, e no Brasil isso corta as três últimas horas do
       * dia. O estorno das 21h30 cairia no fechamento de amanhã.
       */
      .eq('conta_id', contaId).not('estornado_em', 'is', null)
      .gte('estornado_em', instante(de, '00:00', fuso))
      .lte('estornado_em', instante(ate, '23:59', fuso))
      .returns<Array<{
        valor_cent: number; estornado_em: string; motivo_estorno: string | null
        cobranca: { pessoa: { nome: string } | null } | null
      }>>(),
    db.from('pessoa')
      .select('ativo, criado_em, anonimizada_em').eq('conta_id', contaId)
      .returns<Array<{
        ativo: boolean; criado_em: string; anonimizada_em: string | null
      }>>(),
  ])

  if (pagamentos.error) throw pagamentos.error
  if (cobrancas.error) throw cobrancas.error
  if (contratos.error) throw contratos.error

  /*
   * A previsão do mês seguinte não sai do banco: ela é o que os contratos em
   * vigor **vão** gerar, e essas linhas ainda não existem. É a mesma função da
   * materialização, com o horizonte um mês à frente, e por isso já respeita
   * licença e fim de contrato sem repetir a regra aqui.
   */
  const alvo = proximaCompetencia(competenciaDe(ate))
  let previstoCent = 0
  for (const c of contratos.data ?? []) {
    if (c.status === 'encerrado' || !c.plano) continue
    const pausas: Pausa[] = (c.pausa ?? []).map((p) => ({ inicio: p.inicio, fim: p.fim }))
    previstoCent += cobrancasPrevistas({
      inicio: c.inicio,
      fim: fimProrrogado(c.fim, pausas),
      recorrencia: c.plano.recorrencia as Recorrencia,
      parcelas: c.plano.parcelas,
      precoAplicadoCent: c.preco_aplicado_cent,
      diaVencimento: c.dia_vencimento,
      pausas,
    }, alvo)
      .filter((p) => p.competencia === alvo)
      .reduce((s, p) => s + p.valorCent, 0)
  }

  return {
    de,
    ate,
    pagamentos: (pagamentos.data ?? []).map((p) => ({
      valorCent: p.valor_cent,
      forma: p.forma as Forma,
      recebidoEm: p.recebido_em,
      servicoNome: p.cobranca?.contrato?.plano?.servico?.nome ?? 'Sem registro',
      planoNome: p.cobranca?.contrato?.plano?.nome ?? 'Sem registro',
    })),
    cobrancas: (cobrancas.data ?? []).map(paraPeriodo),
    atrasadas: (atrasadas.data ?? []).map(paraPeriodo),
    estornos: (estornos.data ?? []).map((e) => ({
      valorCent: e.valor_cent,
      estornadoEm: e.estornado_em,
      motivo: e.motivo_estorno,
      pessoaNome: e.cobranca?.pessoa?.nome ?? '',
    })),
    pessoas: (pessoas.data ?? []).map((p) => ({
      ativo: p.ativo,
      criadoEm: p.criado_em,
      anonimizada: p.anonimizada_em !== null,
    })),
    contratos: (contratos.data ?? []).map((c) => ({
      inicio: c.inicio,
      fim: c.fim,
      status: c.status as ContratoDoPeriodo['status'],
      precoAplicadoCent: c.preco_aplicado_cent,
      vinculoUsado: c.vinculo_usado,
      precoAvulsoCent: c.plano?.preco_avulso_cent ?? 0,
      precoVinculadoCent: c.plano?.preco_vinculado_cent ?? 0,
    })),
    previstoCent,
  }
}

function paraPeriodo(c: {
  id: string; pessoa_id: string; competencia: string; vencimento: string
  valor_cent: number; valor_pago_cent: number; situacao: string
  pessoa: { nome: string; telefone: string | null } | null
}): CobrancaDoPeriodo {
  return {
    id: c.id,
    pessoaId: c.pessoa_id,
    pessoaNome: c.pessoa?.nome ?? '',
    telefone: c.pessoa?.telefone ?? null,
    competencia: c.competencia,
    vencimento: c.vencimento,
    valorCent: c.valor_cent,
    valorPagoCent: c.valor_pago_cent,
    situacao: c.situacao,
  }
}


export type CaixaDoMes = {
  /** o que entrou no mês corrente, já sem estorno */
  recebidoCent: number
  /** o que entrou no mesmo trecho do mês passado, para comparar */
  recebidoAntesCent: number
  /** o que ainda vence neste mês */
  aVencerCent: number
  /** o vencido e não pago, de qualquer mês: é a pergunta de hoje */
  atrasadoCent: number
  atrasadas: number
}

/**
 * O caixa do mês, para o bloco da tela inicial do dono.
 *
 * O trilho já diz quantas cobranças estão em atraso, e isso responde "tem
 * alguém para ligar?". Quem responde pelo negócio abre o dia com outra
 * pergunta: **como o mês está indo**. Sem isso a home era uma agenda com
 * números de presença, e o dono ia direto para o Financeiro todo dia.
 *
 * A comparação é com o **mesmo trecho** do mês passado, e não com o mês
 * fechado: no dia 5 de setembro, comparar cinco dias com trinta diria que o
 * faturamento caiu 80%, e o número que mente é pior que o número que falta.
 *
 * O estornado sai da soma. Ele é uma linha que existe para explicar por que o
 * dinheiro saiu, e não uma vez que alguém pagou.
 */
export async function caixaDoMes(
  db: Db, contaId: string, hoje: string,
): Promise<CaixaDoMes> {
  const inicioDoMes = competenciaDe(hoje)
  const diaDoMes = Number(hoje.slice(8, 10))

  // o mesmo trecho do mês passado: do dia 1 até o mesmo dia
  const ultimoDoPassado = somarDiasIso(inicioDoMes, -1)
  const inicioDoPassado = competenciaDe(ultimoDoPassado)
  const mesmoDiaNoPassado = (() => {
    const fim = somarDiasIso(inicioDoPassado, diaDoMes - 1)
    return fim > ultimoDoPassado ? ultimoDoPassado : fim
  })()

  const [pagos, abertas] = await Promise.all([
    db.from('pagamento')
      .select('valor_cent, recebido_em, estornado_em')
      .eq('conta_id', contaId)
      .gte('recebido_em', inicioDoPassado)
      .lte('recebido_em', hoje)
      .returns<Array<{
        valor_cent: number; recebido_em: string; estornado_em: string | null
      }>>(),
    db.from('cobranca_resumo')
      .select('valor_cent, valor_pago_cent, vencimento')
      .eq('conta_id', contaId).in('situacao', ['aberta', 'parcial'])
      .lte('vencimento', fimDaCompetencia(inicioDoMes))
      .returns<Array<{
        valor_cent: number; valor_pago_cent: number; vencimento: string
      }>>(),
  ])

  let recebidoCent = 0, recebidoAntesCent = 0
  for (const p of pagos.data ?? []) {
    if (p.estornado_em) continue
    if (p.recebido_em >= inicioDoMes) recebidoCent += p.valor_cent
    else if (p.recebido_em <= mesmoDiaNoPassado) recebidoAntesCent += p.valor_cent
  }

  let aVencerCent = 0, atrasadoCent = 0, atrasadas = 0
  for (const c of abertas.data ?? []) {
    const falta = Math.max(0, c.valor_cent - (c.valor_pago_cent ?? 0))
    if (falta === 0) continue
    if (c.vencimento < hoje) { atrasadoCent += falta; atrasadas++ }
    else aVencerCent += falta
  }

  return { recebidoCent, recebidoAntesCent, aVencerCent, atrasadoCent, atrasadas }
}

/**
 * Somar dias numa data ISO sem passar por fuso.
 *
 * `new Date(iso)` lê meia-noite em UTC, e depois das 21h no Brasil o dia já
 * virou. O meio-dia é o único horário em que somar dia não atravessa fronteira
 * de fuso nenhuma.
 */
function somarDiasIso(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}
