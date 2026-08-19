/**
 * O recibo: o número, o corpo congelado, e o valor por extenso.
 *
 * Sem banco e sem tela, como o resto de `core/`: a emissão, a segunda via e a
 * folha impressa precisam das mesmas respostas, e o corpo escrito em dois
 * lugares divergiria no dia em que só um deles passasse a incluir o CPF.
 */

/**
 * O documento como se lê num papel: `529.982.247-25` ou `12.345.678/0001-90`.
 *
 * Onze dígitos é CPF e catorze é CNPJ; qualquer outra coisa sai como veio, e
 * não some. Um documento que o sistema não reconheceu ainda é o documento que a
 * pessoa digitou, e escondê-lo do recibo seria pior do que imprimi-lo torto.
 */
export function documentoFormatado(bruto: string | null): string | null {
  if (!bruto) return null
  const n = bruto.replace(/\D/g, '')
  if (n.length === 11) {
    return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9)}`
  }
  if (n.length === 14) {
    return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}/${n.slice(8, 12)}-${n.slice(12)}`
  }
  return bruto
}

/** `A-000123`: a série na frente, e zeros à esquerda para a lista alinhar. */
export function numeroFormatado(serie: string, numero: number): string {
  return `${serie}-${String(numero).padStart(6, '0')}`
}

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto',
  'setembro', 'outubro', 'novembro', 'dezembro',
]

/**
 * `19 de agosto de 2026`, que é como um recibo escreve a data.
 *
 * Por extenso e não `19/08/26` pelo mesmo motivo do valor: o papel fica anos
 * numa pasta, e `03/04/26` é 3 de abril para quem escreveu e 4 de março para
 * quem leu depois. Recebe a data como o banco guarda, `aaaa-mm-dd`, e monta o
 * texto na mão: `Date` aqui traria o fuso do servidor junto e o dia 1 viraria
 * o último dia do mês anterior.
 */
export function dataPorExtenso(iso: string): string {
  const [ano, mes, dia] = iso.slice(0, 10).split('-')
  const m = MESES[Number(mes) - 1]
  if (!m) return iso
  return `${Number(dia)} de ${m} de ${ano}`
}

/**
 * A cidade onde o recibo foi emitido, tirada do endereço do emitente.
 *
 * "Local e data" é um dos elementos que se espera de um recibo, e o endereço do
 * emitente é um campo de texto livre: ninguém digitou a cidade separada. Então
 * a cidade se lê do fim, quando o fim é uma UF de duas letras
 * (`Rua das Acácias, 204, Maringá, PR` dá `Maringá`).
 *
 * **Quando não dá para ter certeza, devolve `null` e a folha imprime só a
 * data.** Cidade errada num recibo é pior que cidade ausente: a ausente é uma
 * lacuna que alguém percebe, e a errada é uma afirmação que ninguém confere.
 */
export function localDeEmissao(endereco: string | null): string | null {
  if (!endereco) return null
  const partes = endereco.split(',').map((p) => p.trim()).filter(Boolean)
  if (partes.length < 2) return null
  const ultima = partes[partes.length - 1]
  if (!/^[A-Za-zÀ-ÿ]{2}$/.test(ultima)) return null
  const cidade = partes[partes.length - 2]
  return cidade || null
}

/**
 * Quem apertou o botão, quando isso é um nome de gente.
 *
 * O corpo é congelado e não se recalcula, e por meses ele guardou o **e-mail**
 * de quem emitiu, porque quem responde pelo negócio muitas vezes não está
 * cadastrado como profissional. Esse e-mail ia impresso na via que fica com o
 * aluno: o endereço pessoal de quem manda no estúdio, entregue a cada pagamento
 * a quem só precisa saber que pagou.
 *
 * A emissão nova nunca mais grava e-mail. Esta função é o que resolve o que já
 * está gravado: reconhece o e-mail e devolve `null`, e a folha imprime a linha
 * sem o "por fulano". O corpo continua intacto, e a auditoria continua no
 * `emitido_por_usuario_id`, que é onde ela sempre coube melhor.
 */
export function quemEmitiu(emitidoPor: string | null | undefined): string | null {
  const nome = emitidoPor?.trim()
  if (!nome) return null
  if (nome.includes('@')) return null
  if (nome === 'Não informado') return null
  return nome
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
  /**
   * Quem assina, congelado no ato.
   *
   * O **texto** entra no corpo e a **imagem** não: o nome de quem assinou
   * naquele dia é parte do que o papel afirma, e mudar a responsável técnica em
   * 2027 não pode reescrever quem assinou em 2026. A imagem é a marca do
   * estúdio, e carimbar a segunda via com o carimbo de hoje é o que uma segunda
   * via sempre fez.
   *
   * Opcionais porque todo recibo emitido antes da `0059` não os tem, e a folha
   * precisa continuar saindo igual para eles.
   */
  assinanteNome?: string | null
  assinanteCargo?: string | null
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
  assinanteNome?: string | null
  assinanteCargo?: string | null
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
    assinanteNome: dados.assinanteNome ?? null,
    assinanteCargo: dados.assinanteCargo ?? null,
  }
}

/**
 * O nome que vai embaixo da linha de assinatura.
 *
 * Quem assina é uma pessoa, e nem sempre é a razão social: "Marina Toledo,
 * responsável técnica" é o caso comum num estúdio. Sem assinante configurado
 * cai no emitente, que é quem recebeu e portanto quem quita.
 */
export function quemAssina(corpo: CorpoDoRecibo): { nome: string; cargo: string | null } {
  const nome = corpo.assinanteNome?.trim()
  return {
    nome: nome || corpo.emitenteNome,
    cargo: corpo.assinanteCargo?.trim() || null,
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
