/**
 * O recibo: o número, o corpo congelado, e o valor por extenso.
 *
 * Sem banco e sem tela, como o resto de `core/`: a emissão, a segunda via e a
 * folha impressa precisam das mesmas respostas, e o corpo escrito em dois
 * lugares divergiria no dia em que só um deles passasse a incluir o CPF.
 */

/** `A-000123`: a série na frente, e zeros à esquerda para a lista alinhar. */
export function numeroFormatado(serie: string, numero: number): string {
  return `${serie}-${String(numero).padStart(6, '0')}`
}

const UNIDADES = [
  '', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
  'dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezesseis', 'dezessete',
  'dezoito', 'dezenove',
]
const DEZENAS = [
  '', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta',
  'oitenta', 'noventa',
]
const CENTENAS = [
  '', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos',
  'seiscentos', 'setecentos', 'oitocentos', 'novecentos',
]

/** Um grupo de até três dígitos por extenso: 101 vira "cento e um". */
function ateMil(n: number): string {
  if (n === 100) return 'cem'
  const partes: string[] = []
  const c = Math.floor(n / 100)
  const resto = n % 100
  if (c) partes.push(CENTENAS[c])
  if (resto) {
    if (resto < 20) partes.push(UNIDADES[resto])
    else {
      const d = Math.floor(resto / 10)
      const u = resto % 10
      partes.push(u ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d])
    }
  }
  return partes.join(' e ')
}

/**
 * O valor por extenso, como se escreve num recibo.
 *
 * É a parte deste módulo que mais pede teste, e por três motivos que só
 * aparecem escrevendo: "mil e quinhentos" leva o "e" e "mil quinhentos e um"
 * não leva; "cem" vira "cento" assim que houver dezena depois; e um real e zero
 * centavos é "um real", no singular, que é o caso da aula avulsa mais barata.
 *
 * Zero não é caso de recibo, e mesmo assim tem resposta: recibo de valor zero
 * não deveria existir, e devolver vazio faria a folha sair com uma linha em
 * branco no lugar do valor.
 */
export function porExtenso(cent: number): string {
  const reais = Math.floor(cent / 100)
  const centavos = cent % 100

  const partes: string[] = []
  if (reais > 0) partes.push(`${grupos(reais)} ${reais === 1 ? 'real' : 'reais'}`)
  if (centavos > 0) {
    partes.push(`${ateMil(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`)
  }
  if (partes.length === 0) return 'zero reais'
  return partes.join(' e ')
}

function grupos(n: number): string {
  if (n < 1000) return ateMil(n)

  const milhares = Math.floor(n / 1000)
  const resto = n % 1000
  const cabeca = milhares === 1 ? 'mil' : `${grupos(milhares)} mil`
  if (resto === 0) return cabeca

  /*
   * O "e" antes do resto só entra quando o resto é redondo ou menor que cem:
   * "mil e quinhentos", "mil e vinte", mas "mil quinhentos e um". É a regra que
   * todo mundo escreve errado, e a que um recibo não pode escrever errado.
   */
  const ligacao = resto < 100 || resto % 100 === 0 ? ' e ' : ' '
  return `${cabeca}${ligacao}${ateMil(resto)}`
}

export type Emitente = {
  razaoSocial: string | null
  documento: string | null
  endereco: string | null
  telefone: string | null
  /** o nome da conta, que é o que aparece quando não há razão social */
  nomeDaConta: string
}

/** O emitente está preenchido o bastante para um papel valer? */
export function emitenteCompleto(e: Emitente): boolean {
  return Boolean(e.razaoSocial?.trim() && e.documento?.trim())
}

export type CorpoDoRecibo = {
  /** quem emitiu, como estava no dia */
  emitenteNome: string
  emitenteDocumento: string | null
  emitenteEndereco: string | null
  emitenteTelefone: string | null
  /** quem pagou */
  pagadorNome: string
  pagadorDocumento: string | null
  pagadorMatricula: string | null
  pagadorEndereco: string | null
  /** o que foi pago */
  referente: string
  valorCent: number
  valorPorExtenso: string
  forma: string
  recebidoEm: string
  /** quem apertou o botão */
  emitidoPor: string
  emitidoEm: string
}

/**
 * O corpo congelado, montado uma vez e nunca recalculado.
 *
 * Tudo que a folha imprime entra aqui, inclusive o que hoje sairia igual de uma
 * consulta: o preço do plano muda, o endereço da pessoa muda, e o nome dela some
 * no dia em que ela pedir exclusão. Uma segunda via emitida daqui a um ano
 * precisa sair idêntica à primeira.
 */
export function montarCorpo(dados: {
  emitente: Emitente
  pagador: {
    nome: string
    documento: string | null
    matricula: string | null
    endereco: string | null
  }
  referente: string
  valorCent: number
  forma: string
  recebidoEm: string
  emitidoPor: string
  emitidoEm: string
}): CorpoDoRecibo {
  return {
    emitenteNome: dados.emitente.razaoSocial?.trim() || dados.emitente.nomeDaConta,
    emitenteDocumento: dados.emitente.documento,
    emitenteEndereco: dados.emitente.endereco,
    emitenteTelefone: dados.emitente.telefone,
    pagadorNome: dados.pagador.nome,
    pagadorDocumento: dados.pagador.documento,
    pagadorMatricula: dados.pagador.matricula,
    pagadorEndereco: dados.pagador.endereco,
    referente: dados.referente,
    valorCent: dados.valorCent,
    valorPorExtenso: porExtenso(dados.valorCent),
    forma: dados.forma,
    recebidoEm: dados.recebidoEm,
    emitidoPor: dados.emitidoPor,
    emitidoEm: dados.emitidoEm,
  }
}

export type StatusRecibo = 'valido' | 'cancelado' | 'substituido'

/**
 * O que se pode fazer com um recibo, e por quê.
 *
 * As três respostas vêm do mesmo lugar: o papel já saiu. Cancelar o que já foi
 * cancelado não faz nada; corrigir o que foi substituído corrigiria uma versão
 * que ninguém tem na mão; e a segunda via de um cancelado precisa sair, porque
 * é ela que prova o cancelamento para quem guardou a via antiga.
 */
export function podeCancelar(status: StatusRecibo): boolean {
  return status === 'valido'
}

export function podeCorrigir(status: StatusRecibo): boolean {
  return status === 'valido'
}

/** A linha que a lista mostra, e que o documento chama de "arquivado". */
export function descricaoDoRecibo(r: {
  serie: string
  numero: number
  versao: number
  status: StatusRecibo
}): string {
  const base = numeroFormatado(r.serie, r.numero)
  if (r.versao > 1) return `${base} (correção ${r.versao})`
  return base
}
