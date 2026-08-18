import { diasDeAtraso, situacaoDaCobranca } from './cobranca'

/**
 * As sete perguntas do fechamento, respondidas por função pura.
 *
 * Elas moram aqui, e não na consulta, por dois motivos. O primeiro é o de
 * sempre: a tela e a planilha precisam do mesmo número, e duas somas escritas
 * em dois lugares divergem no dia em que só uma delas passar a ignorar o
 * estornado. O segundo é que soma de dinheiro é a coisa mais barata de testar e
 * a mais cara de errar, e teste de soma não deveria precisar de banco.
 *
 * Nenhuma delas conhece fuso: quem sabe que dia é hoje na conta é `src/server`.
 */

export type Forma =
  'pix' | 'dinheiro' | 'credito' | 'debito' | 'transferencia' | 'boleto'

export const ROTULO_FORMA: Record<Forma, string> = {
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  credito: 'Cartão de crédito',
  debito: 'Cartão de débito',
  transferencia: 'Transferência',
  boleto: 'Boleto',
}

export type PagamentoRecebido = {
  valorCent: number
  forma: Forma
  recebidoEm: string
  servicoNome: string
  planoNome: string
}

export type CobrancaDoPeriodo = {
  id: string
  pessoaId: string
  pessoaNome: string
  telefone: string | null
  competencia: string
  vencimento: string
  valorCent: number
  valorPagoCent: number
  situacao: string
}

/** 1. Quanto entrou no período, e por qual forma. */
export function recebidoPorForma(pagamentos: PagamentoRecebido[]): {
  totalCent: number
  porForma: Array<{ forma: Forma; rotulo: string; totalCent: number; quantidade: number }>
} {
  const mapa = new Map<Forma, { totalCent: number; quantidade: number }>()
  for (const p of pagamentos) {
    const atual = mapa.get(p.forma) ?? { totalCent: 0, quantidade: 0 }
    mapa.set(p.forma, {
      totalCent: atual.totalCent + p.valorCent,
      quantidade: atual.quantidade + 1,
    })
  }
  return {
    totalCent: pagamentos.reduce((s, p) => s + p.valorCent, 0),
    porForma: [...mapa.entries()]
      .map(([forma, v]) => ({ forma, rotulo: ROTULO_FORMA[forma], ...v }))
      .sort((a, b) => b.totalCent - a.totalCent),
  }
}

/**
 * 2. Quanto ainda vai vencer no período.
 *
 * O que falta, e não o valor cheio: uma cobrança de R$ 735 com R$ 300 pagos
 * ainda vai receber R$ 435, e somar os R$ 735 diria que o mês fecha melhor do
 * que ele fecha.
 */
export function aReceber(cobrancas: CobrancaDoPeriodo[], hoje: string): {
  totalCent: number
  aVencerCent: number
  vencidoCent: number
} {
  let aVencer = 0
  let vencido = 0
  for (const c of cobrancas) {
    const situacao = situacaoDaCobranca(c, hoje)
    if (situacao === 'paga' || situacao === 'cancelada') continue
    const falta = Math.max(0, c.valorCent - c.valorPagoCent)
    if (situacao === 'atrasada') vencido += falta
    else aVencer += falta
  }
  return { totalCent: aVencer + vencido, aVencerCent: aVencer, vencidoCent: vencido }
}

export type LinhaDeAtraso = {
  pessoaId: string
  pessoaNome: string
  telefone: string | null
  cobrancas: number
  totalCent: number
  diasDoMaisVelho: number
}

/**
 * 3. Quem está em atraso, há quantos dias, e qual o telefone.
 *
 * Por pessoa, e não por cobrança: quem deve três meses recebe uma ligação, não
 * três. E com telefone, porque a lista existe para alguém ligar; número sozinho
 * não faz ninguém ligar para ninguém.
 */
export function emAtraso(
  cobrancas: CobrancaDoPeriodo[], hoje: string,
): LinhaDeAtraso[] {
  const mapa = new Map<string, LinhaDeAtraso>()
  for (const c of cobrancas) {
    if (situacaoDaCobranca(c, hoje) !== 'atrasada') continue
    const dias = diasDeAtraso(c.vencimento, hoje)
    const atual = mapa.get(c.pessoaId) ?? {
      pessoaId: c.pessoaId, pessoaNome: c.pessoaNome, telefone: c.telefone,
      cobrancas: 0, totalCent: 0, diasDoMaisVelho: 0,
    }
    mapa.set(c.pessoaId, {
      ...atual,
      cobrancas: atual.cobrancas + 1,
      totalCent: atual.totalCent + Math.max(0, c.valorCent - c.valorPagoCent),
      diasDoMaisVelho: Math.max(atual.diasDoMaisVelho, dias),
    })
  }
  // o mais velho primeiro: é a ordem em que a recepção liga
  return [...mapa.values()].sort((a, b) => b.diasDoMaisVelho - a.diasDoMaisVelho)
}

/**
 * 4. Quanto cada modalidade faturou, e cada plano.
 *
 * Sobre o que **entrou**, e não sobre o que foi cobrado: faturamento de mês que
 * ninguém pagou é a conta que quebra estúdio.
 */
export function faturamentoPor(
  pagamentos: PagamentoRecebido[], chave: 'servicoNome' | 'planoNome',
): Array<{ nome: string; totalCent: number; quantidade: number }> {
  const mapa = new Map<string, { totalCent: number; quantidade: number }>()
  for (const p of pagamentos) {
    const nome = p[chave] || 'Sem registro'
    const atual = mapa.get(nome) ?? { totalCent: 0, quantidade: 0 }
    mapa.set(nome, {
      totalCent: atual.totalCent + p.valorCent,
      quantidade: atual.quantidade + 1,
    })
  }
  return [...mapa.entries()]
    .map(([nome, v]) => ({ nome, ...v }))
    .sort((a, b) => b.totalCent - a.totalCent)
}

export type ContratoDoPeriodo = {
  inicio: string
  fim: string | null
  status: 'ativo' | 'pausado' | 'encerrado'
  precoAplicadoCent: number
  vinculoUsado: boolean
  precoAvulsoCent: number
  precoVinculadoCent: number
}

/**
 * 5. Como está a carteira.
 *
 * Novos e encerrados no período, e quantos seguem de pé, com o valor recorrente
 * que eles representam. É o número que responde "estamos crescendo", que
 * nenhuma das somas de caixa responde.
 */
export function carteira(
  contratos: ContratoDoPeriodo[], de: string, ate: string,
): { novos: number; encerrados: number; emVigor: number; recorrenteCent: number } {
  const novos = contratos.filter((c) => c.inicio >= de && c.inicio <= ate).length
  const encerrados = contratos.filter((c) =>
    c.status === 'encerrado' && c.fim !== null && c.fim >= de && c.fim <= ate).length
  const vivos = contratos.filter((c) => c.status !== 'encerrado')
  return {
    novos,
    encerrados,
    emVigor: vivos.length,
    // pausado não entra no recorrente: quem está em licença não paga o período
    // parado, e contar o dinheiro dele é prever caixa que não vem
    recorrenteCent: vivos
      .filter((c) => c.status === 'ativo')
      .reduce((s, c) => s + c.precoAplicadoCent, 0),
  }
}

/**
 * 7. Quanto o preço de vínculo custou.
 *
 * A diferença entre o que o plano cobra de quem não é cliente de outra
 * modalidade e o que foi de fato cobrado. É a única regra de preço que o
 * sistema aplica sozinho, e quem responde pelo negócio precisa poder ver o
 * tamanho dela antes de decidir mantê-la.
 */
export function descontoDeVinculo(contratos: ContratoDoPeriodo[]): {
  contratos: number
  totalCent: number
} {
  const comDesconto = contratos.filter((c) => c.vinculoUsado)
  return {
    contratos: comDesconto.length,
    totalCent: comDesconto.reduce(
      (s, c) => s + Math.max(0, c.precoAvulsoCent - c.precoVinculadoCent), 0),
  }
}
