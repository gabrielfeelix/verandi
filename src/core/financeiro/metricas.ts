/**
 * Os números que uma lista de dinheiro precisa mostrar em cima dela.
 *
 * A tela dizia "10 cobranças em atraso" e não dizia **quanto**. Dez linhas de
 * R$ 90 e dez linhas de R$ 700 são a mesma frase e duas manhãs diferentes, e
 * quem abre o Financeiro está decidindo o que fazer com a manhã.
 *
 * Sem banco, como o resto de `core/`: a faixa da tela, o resumo da ficha e o
 * fechamento precisam da mesma soma, e soma escrita em dois lugares diverge no
 * dia em que só uma delas passar a ignorar o estornado.
 */

export type LinhaSomavel = {
  valorCent: number
  valorPagoCent: number
  situacao: string
}

export type ResumoDeCobrancas = {
  quantidade: number
  /** o que foi cobrado, sem o que está cancelado */
  totalCent: number
  /** o que já entrou dessas cobranças */
  pagoCent: number
  /** o que falta entrar: é o número que vira ligação */
  abertoCent: number
  /** quantas ainda devem alguma coisa */
  quantidadeAberta: number
  canceladasCent: number
  quantidadeCancelada: number
  /** o valor médio da cobrança, ignorando as canceladas */
  ticketCent: number
}

/**
 * Soma uma lista de cobranças.
 *
 * **A cancelada sai da soma e continua contada.** Ela existe, tem motivo à
 * vista e alguém vai perguntar por ela no fim do mês; o que ela não pode é
 * inflar o "vai entrar", porque não vai. Somar cancelada no total é como o
 * fechamento passaria a prometer dinheiro que ninguém combinou de pagar.
 *
 * O aberto é `valor - pago`, e nunca negativo: quem pagou a mais (juro
 * combinado no balcão) não vira crédito automático, porque o sistema não sabe
 * do acerto que houve ali.
 */
export function resumoDeCobrancas(linhas: LinhaSomavel[]): ResumoDeCobrancas {
  let totalCent = 0, pagoCent = 0, abertoCent = 0
  let quantidadeAberta = 0
  let canceladasCent = 0, quantidadeCancelada = 0
  let contadasNoTicket = 0

  for (const l of linhas) {
    if (l.situacao === 'cancelada') {
      canceladasCent += l.valorCent
      quantidadeCancelada++
      continue
    }
    totalCent += l.valorCent
    pagoCent += Math.min(l.valorPagoCent, l.valorCent)
    const falta = Math.max(0, l.valorCent - l.valorPagoCent)
    abertoCent += falta
    if (falta > 0) quantidadeAberta++
    contadasNoTicket++
  }

  return {
    quantidade: linhas.length,
    totalCent,
    pagoCent,
    abertoCent,
    quantidadeAberta,
    canceladasCent: canceladasCent,
    quantidadeCancelada,
    ticketCent: contadasNoTicket ? Math.round(totalCent / contadasNoTicket) : 0,
  }
}

export type LinhaDeRecibo = {
  valorCent: number
  status: string
}

export type ResumoDeRecibos = {
  quantidade: number
  validos: number
  cancelados: number
  substituidos: number
  /** o valor dos que valem: o cancelado não comprova mais nada */
  validoCent: number
}

/**
 * Soma uma lista de recibos.
 *
 * O cancelado conta na quantidade e não conta no valor, pela mesma razão de o
 * número dele continuar ocupado: ele existiu, o papel saiu, e alguém precisa
 * poder explicá-lo. O que ele não faz é comprovar recebimento.
 */
export function resumoDeRecibos(linhas: LinhaDeRecibo[]): ResumoDeRecibos {
  let validos = 0, cancelados = 0, substituidos = 0, validoCent = 0
  for (const r of linhas) {
    if (r.status === 'cancelado') { cancelados++; continue }
    if (r.status === 'substituido') { substituidos++; continue }
    validos++
    validoCent += r.valorCent
  }
  return {
    quantidade: linhas.length,
    validos, cancelados, substituidos, validoCent,
  }
}

export type ResumoDaPessoa = {
  /** tudo que já entrou dela, em toda a vida na casa */
  pagoCent: number
  /** o que falta pagar, vencido ou não */
  abertoCent: number
  /** o que já venceu e não foi pago */
  atrasadoCent: number
  quantidadeAtrasada: number
  /** desde quando ela paga: a data do primeiro pagamento */
  primeiroPagamento: string | null
  ultimoPagamento: string | null
  /** a forma que ela mais usa, que é o palpite certo do modal de receber */
  formaMaisUsada: string | null
}

export type PagamentoDaPessoa = {
  valorCent: number
  recebidoEm: string
  forma: string
  estornado: boolean
}

/**
 * O retrato financeiro de uma pessoa, para a ficha dela.
 *
 * A ficha listava as cobranças e não respondia nenhuma das perguntas que se faz
 * olhando para uma pessoa: ela está em dia? paga desde quando? deve quanto?
 * Ler dez linhas e somar de cabeça na frente de quem está esperando não é
 * resposta.
 *
 * **O estornado não conta em lugar nenhum aqui**, nem no total pago nem na
 * forma mais usada: ele é uma linha que existe para explicar por que o dinheiro
 * saiu, e não uma vez que a pessoa pagou.
 */
export function resumoDaPessoa(
  cobrancas: Array<LinhaSomavel & { vencimento: string }>,
  pagamentos: PagamentoDaPessoa[],
  hoje: string,
): ResumoDaPessoa {
  let pagoCent = 0
  const porForma = new Map<string, number>()
  let primeiro: string | null = null
  let ultimo: string | null = null

  for (const p of pagamentos) {
    if (p.estornado) continue
    pagoCent += p.valorCent
    porForma.set(p.forma, (porForma.get(p.forma) ?? 0) + 1)
    if (!primeiro || p.recebidoEm < primeiro) primeiro = p.recebidoEm
    if (!ultimo || p.recebidoEm > ultimo) ultimo = p.recebidoEm
  }

  let abertoCent = 0, atrasadoCent = 0, quantidadeAtrasada = 0
  for (const c of cobrancas) {
    if (c.situacao === 'cancelada') continue
    const falta = Math.max(0, c.valorCent - c.valorPagoCent)
    if (falta === 0) continue
    abertoCent += falta
    if (c.vencimento < hoje) { atrasadoCent += falta; quantidadeAtrasada++ }
  }

  let formaMaisUsada: string | null = null
  let maior = 0
  for (const [forma, n] of porForma) {
    if (n > maior) { maior = n; formaMaisUsada = forma }
  }

  return {
    pagoCent,
    abertoCent,
    atrasadoCent,
    quantidadeAtrasada,
    primeiroPagamento: primeiro,
    ultimoPagamento: ultimo,
    formaMaisUsada,
  }
}

/**
 * A variação entre dois períodos, em pontos percentuais inteiros.
 *
 * `null` quando não há com o que comparar: sair de zero para R$ 4.000 não é
 * "aumento de infinito por cento", é o primeiro mês. Mostrar um número ali
 * seria inventar uma tendência a partir de um ponto só.
 */
export function variacao(agoraCent: number, antesCent: number): number | null {
  if (antesCent <= 0) return null
  return Math.round(((agoraCent - antesCent) / antesCent) * 100)
}
