import type { Db } from '../supabase'
import type { Recorrencia } from '@/core/planos/plano'
import { fimProrrogado, type Pausa } from '@/core/contratos/contrato'
import {
  cobrancasPrevistas, competenciaDe, fimDaCompetencia, proximaCompetencia,
  situacaoDaCobranca, diasDeAtraso, type SituacaoCobranca,
} from '@/core/financeiro/cobranca'
import type {
  CobrancaDoPeriodo, ContratoDoPeriodo, Forma, PagamentoRecebido,
} from '@/core/financeiro/fechamento'

export const POR_PAGINA = 20

export type PagamentoLinha = {
  id: string
  valorCent: number
  forma: Forma
  recebidoEm: string
  observacao: string | null
  estornado: boolean
  motivoEstorno: string | null
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
    })).sort((a, b) => a.recebidoEm.localeCompare(b.recebidoEm)),
  }
}

export type FiltroCobranca = 'atrasadas' | 'a_vencer' | 'pagas' | 'canceladas'

/**
 * As cobranças de uma aba, paginadas.
 *
 * A ordem é a do que dói primeiro: em atraso, o mais velho na frente; a vencer,
 * o mais próximo na frente; paga, a mais recente. A recepção não pede
 * ordenação, ela pede a próxima ligação.
 */
export async function listarCobrancas(
  db: Db, contaId: string, hoje: string,
  opcoes: { filtro: FiltroCobranca; busca?: string; pagina?: number },
): Promise<{ linhas: CobrancaLinha[]; total: number }> {
  const pagina = Math.max(1, opcoes.pagina ?? 1)
  const de = (pagina - 1) * POR_PAGINA

  let q = db.from('cobranca_resumo').select(SELECT_LINHA, { count: 'exact' })
    .eq('conta_id', contaId)

  if (opcoes.filtro === 'canceladas') {
    q = q.eq('situacao', 'cancelada').order('vencimento', { ascending: false })
  } else if (opcoes.filtro === 'pagas') {
    q = q.eq('situacao', 'paga').order('vencimento', { ascending: false })
  } else if (opcoes.filtro === 'atrasadas') {
    q = q.in('situacao', ['aberta', 'parcial']).lt('vencimento', hoje)
      .order('vencimento', { ascending: true })
  } else {
    q = q.in('situacao', ['aberta', 'parcial']).gte('vencimento', hoje)
      .order('vencimento', { ascending: true })
  }

  if (opcoes.busca?.trim()) {
    /*
     * O nome vai numa segunda consulta: `ilike` em coluna de tabela ligada não
     * filtra a de cima no PostgREST, e trazer tudo para filtrar em memória
     * pagina errado, que é o defeito que ninguém percebe até a lista passar de
     * vinte linhas.
     */
    const { data: pessoas } = await db.from('pessoa')
      .select('id').eq('conta_id', contaId)
      .ilike('nome', `%${opcoes.busca.trim()}%`).limit(200)
    const ids = (pessoas ?? []).map((p) => p.id)
    if (ids.length === 0) return { linhas: [], total: 0 }
    q = q.in('pessoa_id', ids)
  }

  const { data, error, count } = await q.range(de, de + POR_PAGINA - 1)
    .returns<LinhaCrua[]>()
  if (error) throw error

  return { linhas: (data ?? []).map((c) => paraLinha(c, hoje)), total: count ?? 0 }
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

/** As cobranças de uma pessoa, da mais nova para a mais velha. */
export async function cobrancasDaPessoa(
  db: Db, contaId: string, pessoaId: string, hoje: string,
): Promise<CobrancaLinha[]> {
  const { data, error } = await db.from('cobranca_resumo').select(SELECT_LINHA)
    .eq('conta_id', contaId).eq('pessoa_id', pessoaId)
    .order('competencia', { ascending: false })
    .returns<LinhaCrua[]>()
  if (error) throw error
  return (data ?? []).map((c) => paraLinha(c, hoje))
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
  db: Db, contaId: string, de: string, ate: string, hoje: string,
): Promise<Fechamento> {
  const [pagamentos, cobrancas, contratos, atrasadas] = await Promise.all([
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
