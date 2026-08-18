import { diasDeAtraso, situacaoDaCobranca } from './cobranca'

/**
 * Os sete relatórios do item 4 do documento do cliente, respondidos por função
 * pura.
 *
 * Eles estão escritos lá com estas palavras: valores faturados por
 * dia/semana/mês/ano; faturamento por plano e por modalidade; recibos emitidos
 * e cancelados; estornos; clientes ativos; clientes inativos; novos clientes no
 * mês. O terceiro depende do módulo 18 e chega com ele.
 *
 * Eles moram aqui, e não na consulta, por dois motivos. O primeiro é o de
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

/**
 * 1. Valores faturados no período, e por qual forma.
 *
 * O documento pede por dia, semana, mês e ano; quem escolhe o período é a tela,
 * e esta função soma o que ela mandar. A forma de pagamento não foi pedida e
 * fica: é ela que fecha o caixa contra o dinheiro na gaveta.
 */
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
 * Quanto ainda vai vencer no período.
 *
 * Não está entre os sete, e fica: a planilha do item 4 tem as colunas "Venc
 * Plano" e "Novo Venc", e elas existem para responder exatamente isto.
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
 * Quem está em atraso, há quantos dias, e qual o telefone.
 *
 * Também não está entre os sete, e também fica, pelo mesmo motivo: sem ela, as
 * colunas de vencimento da planilha do cliente viram enfeite.
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
 * 2. Faturamento por plano e por modalidade (serviços).
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
 * A carteira, que o documento não pede e a planilha dele pressupõe.
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

export type EstornoDoPeriodo = {
  valorCent: number
  estornadoEm: string
  motivo: string | null
  pessoaNome: string
}

/**
 * 4. Estornos (cancelamentos), com as palavras do documento.
 *
 * O que voltou atrás, e por quê. Sem esta linha, o "entrou no período" de um
 * mês em que se estornou R$ 2.000 conta uma história incompleta, e a diferença
 * só aparece quando alguém confere o extrato do banco contra a tela.
 */
export function estornosDoPeriodo(estornos: EstornoDoPeriodo[]): {
  quantidade: number
  totalCent: number
  linhas: EstornoDoPeriodo[]
} {
  return {
    quantidade: estornos.length,
    totalCent: estornos.reduce((s, e) => s + e.valorCent, 0),
    // o mais recente primeiro: estorno é sempre conversa fresca
    linhas: [...estornos].sort((a, b) => b.estornadoEm.localeCompare(a.estornadoEm)),
  }
}

export type PessoaDaConta = {
  ativo: boolean
  criadoEm: string
  anonimizada: boolean
}

/**
 * 5, 6 e 7. Clientes ativos, inativos, e os novos do período.
 *
 * Conta **pessoas**, e não contratos: o documento pede "clientes/alunos
 * ativos", e quem tem dois contratos é um cliente só. Ativo é a marca da ficha,
 * a mesma que a lista de pessoas usa, para os dois números nunca discordarem.
 *
 * Quem pediu exclusão sai das três contagens: a ficha continua existindo por
 * causa do histórico, mas ela não descreve mais ninguém.
 */
export function clientes(pessoas: PessoaDaConta[], de: string, ate: string): {
  ativos: number
  inativos: number
  novos: number
} {
  const vivas = pessoas.filter((p) => !p.anonimizada)
  return {
    ativos: vivas.filter((p) => p.ativo).length,
    inativos: vivas.filter((p) => !p.ativo).length,
    novos: vivas.filter((p) => {
      const dia = p.criadoEm.slice(0, 10)
      return dia >= de && dia <= ate
    }).length,
  }
}

/**
 * Quanto o preço de vínculo custou.
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
