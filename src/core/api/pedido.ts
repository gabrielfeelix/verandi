/**
 * O que a API aceita como entrada, decidido sem banco e sem rede.
 *
 * Validação de fronteira é o tipo de coisa que se escreve dentro da rota e
 * depois ninguém testa. Aqui ela é função pura, e cada regra tem um teste.
 */

/** o formato de data que entra e sai da API: local da conta, nunca instante */
const DATA = /^\d{4}-\d{2}-\d{2}$/

export type Erro = { campo: string; mensagem: string }

/**
 * Uma data local válida, ou o erro que a rota devolve.
 *
 * Não basta casar o formato: `2026-02-31` casa e não existe. O `Date` do
 * JavaScript aceita e rola para março, então a conferência é comparar o que
 * saiu com o que entrou.
 */
export function dataValida(bruto: string | null, campo: string): Erro | null {
  if (!bruto) return { campo, mensagem: `${campo} é obrigatório, no formato AAAA-MM-DD` }
  if (!DATA.test(bruto)) return { campo, mensagem: `${campo} precisa ser AAAA-MM-DD` }
  const d = new Date(`${bruto}T12:00:00Z`)
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== bruto) {
    return { campo, mensagem: `${campo} não é uma data que existe` }
  }
  return null
}

/**
 * O maior intervalo que a API responde de uma vez.
 *
 * Não é limite de gosto: ler a agenda **materializa** as sessões da janela, e
 * um pedido de dois anos criaria milhares de linhas de uma vez porque alguém
 * digitou o ano errado. Noventa dias cobrem qualquer conversa de bot ("tem
 * horário em novembro?") com folga.
 */
export const JANELA_MAXIMA_DIAS = 90

export function intervaloValido(de: string, ate: string): Erro | null {
  if (ate < de) return { campo: 'ate', mensagem: 'ate não pode ser antes de de' }
  const dias = (Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 864e5
  if (dias > JANELA_MAXIMA_DIAS) {
    return {
      campo: 'ate',
      mensagem: `o intervalo não pode passar de ${JANELA_MAXIMA_DIAS} dias`,
    }
  }
  return null
}

/**
 * Um identificador que veio na URL.
 *
 * Recusar aqui o que não é UUID evita mandar texto arbitrário para o `where` e
 * receber de volta um erro de Postgres com o nome da coluna dentro — que é
 * informação de graça para quem está tentando.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function idValido(bruto: string | null, campo: string): Erro | null {
  if (bruto === null || bruto === '') return null
  return UUID.test(bruto) ? null : { campo, mensagem: `${campo} não é um id válido` }
}

export function idObrigatorio(bruto: unknown, campo: string): Erro | null {
  if (typeof bruto !== 'string' || bruto === '') {
    return { campo, mensagem: `${campo} é obrigatório` }
  }
  return idValido(bruto, campo)
}

/**
 * Um texto que veio no corpo de um `POST`.
 *
 * O `trim` acontece aqui e o resultado é o que a rota grava: nome com espaço no
 * fim vira duplicata invisível na busca, e quem digitou foi um robô copiando de
 * uma conversa de WhatsApp, onde sobra espaço.
 */
export function texto(
  bruto: unknown,
  campo: string,
  regras: { obrigatorio?: boolean; max: number },
): { valor: string | null; erro: Erro | null } {
  if (bruto === undefined || bruto === null || bruto === '') {
    return regras.obrigatorio
      ? { valor: null, erro: { campo, mensagem: `${campo} é obrigatório` } }
      : { valor: null, erro: null }
  }
  if (typeof bruto !== 'string') {
    return { valor: null, erro: { campo, mensagem: `${campo} precisa ser texto` } }
  }
  const limpo = bruto.trim()
  if (regras.obrigatorio && limpo === '') {
    return { valor: null, erro: { campo, mensagem: `${campo} é obrigatório` } }
  }
  if (limpo.length > regras.max) {
    return {
      valor: null,
      erro: { campo, mensagem: `${campo} não pode passar de ${regras.max} caracteres` },
    }
  }
  return { valor: limpo === '' ? null : limpo, erro: null }
}

/**
 * Um valor que só pode ser um de uma lista fechada.
 *
 * A mensagem **diz quais são**. Erro que recusa sem dizer o que aceitar obriga
 * quem integra a ir procurar documentação, e é aí que a integração para no meio.
 */
export function escolha<T extends string>(
  bruto: unknown,
  campo: string,
  aceitos: readonly T[],
  padrao: T,
): { valor: T; erro: Erro | null } {
  if (bruto === undefined || bruto === null || bruto === '') {
    return { valor: padrao, erro: null }
  }
  if (typeof bruto === 'string' && (aceitos as readonly string[]).includes(bruto)) {
    return { valor: bruto as T, erro: null }
  }
  return {
    valor: padrao,
    erro: { campo, mensagem: `${campo} precisa ser um destes: ${aceitos.join(', ')}` },
  }
}

/** o primeiro erro da lista, que é o único que a rota precisa contar */
export function primeiro(...erros: Array<Erro | null>): Erro | null {
  return erros.find((e) => e !== null) ?? null
}
