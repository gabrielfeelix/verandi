import type { Recorrencia } from '@/core/planos/plano'
import type { Pausa } from '@/core/contratos/contrato'

/**
 * O que um contrato deve, quando vence, e como está.
 *
 * Sem banco e sem tela, como o resto de `core/`: a materialização, a ficha da
 * pessoa e o fechamento do mês precisam das mesmas respostas, e conta repetida
 * em três lugares diverge no dia em que só duas delas forem corrigidas.
 *
 * Data aqui é sempre `YYYY-MM-DD` e a aritmética passa por UTC. `new Date` sem
 * o `T00:00:00Z` é lido no fuso da máquina, e no Brasil isso volta um dia.
 */

const paraData = (iso: string): Date => new Date(`${iso}T00:00:00Z`)
const paraIso = (d: Date): string => d.toISOString().slice(0, 10)

const DIA = 86_400_000

/** O dia 1 do mês de uma data: é assim que competência se escreve. */
export const competenciaDe = (iso: string): string => `${iso.slice(0, 7)}-01`

/** A competência seguinte, sem escorregar de dezembro para o mês 13. */
export function proximaCompetencia(competencia: string): string {
  const d = paraData(competencia)
  return paraIso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)))
}

/**
 * O último dia do mês de uma competência.
 *
 * É o que decide se um mês está inteiro dentro de uma licença, e é a única
 * pergunta deste arquivo que depende de fevereiro existir.
 */
export function fimDaCompetencia(competencia: string): string {
  const d = paraData(competencia)
  return paraIso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)))
}

/**
 * Quando a competência vence.
 *
 * Dia 31 num mês de trinta cai no dia 30, e não escorrega para o mês seguinte:
 * quem escolheu o último dia do mês quis o último dia do mês. É a mesma regra
 * de `proximoVencimento`, do contrato, escrita para uma competência em vez de
 * para hoje.
 *
 * Sem dia de vencimento escolhido, vence no primeiro dia do mês: cobrança sem
 * data não aparece em nenhuma lista, e o que não aparece não é cobrado.
 */
export function vencimentoDa(competencia: string, diaVencimento: number | null): string {
  const d = paraData(competencia)
  if (!diaVencimento) return competencia
  const ultimo = new Date(Date.UTC(
    d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  return paraIso(new Date(Date.UTC(
    d.getUTCFullYear(), d.getUTCMonth(), Math.min(diaVencimento, ultimo))))
}

/** O mês está inteiro dentro de uma licença? */
export function mesTrancado(competencia: string, pausas: Pausa[]): boolean {
  const fim = fimDaCompetencia(competencia)
  return pausas.some((p) => {
    // pausa em aberto engole tudo daí para frente: enquanto ninguém disse
    // quando volta, ninguém pode dizer que o mês foi entregue
    const fimDaPausa = p.fim ?? '9999-12-31'
    return p.inicio <= competencia && fimDaPausa >= fim
  })
}

export type ContratoParaCobrar = {
  inicio: string
  /** o fim já prorrogado pelas pausas, ou `null` no que não tem fim previsto */
  fim: string | null
  recorrencia: Recorrencia
  /** em quantas vezes o valor do período foi dividido */
  parcelas: number
  precoAplicadoCent: number
  diaVencimento: number | null
  pausas: Pausa[]
}

export type CobrancaPrevista = {
  competencia: string
  vencimento: string
  valorCent: number
}

const MESES: Partial<Record<Recorrencia, number>> = {
  mensal: 1, trimestral: 3, semestral: 6, anual: 12,
}

const maisTarde = (a: string, b: string): string => (a >= b ? a : b)

/**
 * O valor dividido em parcelas, com o centavo que sobra na primeira.
 *
 * R$ 1.980 em três dá exato; R$ 100 em três dá 33,34 mais 33,33 mais 33,33. A
 * sobra vai para a primeira porque é a que o cliente vê no ato da venda, e
 * porque a soma das parcelas tem que bater com o preço do contrato: essa é a
 * conta que o recibo do módulo 18 vai imprimir.
 */
export function valorDaParcela(totalCent: number, parcelas: number): number[] {
  const base = Math.floor(totalCent / parcelas)
  const sobra = totalCent - base * parcelas
  return Array.from({ length: parcelas }, (_, i) => base + (i === 0 ? sobra : 0))
}

/**
 * As cobranças que um contrato deve até o horizonte, com a data e o valor.
 *
 * O horizonte é do chamador, e na prática é o mês aberto mais um. Materializar
 * até o fim de um contrato anual põe doze linhas na tela de quem só quer saber
 * o que vence esta semana, e transforma "a receber" num número ilegível.
 *
 * **Mês trancado não gera cobrança.** É a metade que faltava do trancar: quem
 * está em licença não paga o período parado, e o fim do contrato já anda para
 * frente pelos dias parados. Sem isto, trancar viraria dívida enquanto a pessoa
 * nem podia entrar na sala.
 *
 * Mês partido pela metade gera cobrança cheia: proporcional é decisão comercial
 * do estúdio, e não do software.
 */
export function cobrancasPrevistas(
  c: ContratoParaCobrar, ateCompetencia: string,
): CobrancaPrevista[] {
  /*
   * Avulsa e pacote são uma cobrança só, na competência em que começaram: o
   * pacote de dez sessões é pago uma vez e consumido ao longo da validade, e
   * cobrá-lo todo mês seria vender assinatura para quem comprou pacote.
   */
  if (c.recorrencia === 'avulsa' || c.recorrencia === 'pacote') {
    const competencia = competenciaDe(c.inicio)
    if (competencia > ateCompetencia) return []
    return [{
      competencia,
      // a avulsa vence no dia em que aconteceu, e não no dia 5 do mês que vem
      vencimento: c.recorrencia === 'avulsa'
        ? c.inicio
        : maisTarde(vencimentoDa(competencia, c.diaVencimento), c.inicio),
      valorCent: c.precoAplicadoCent,
    }]
  }

  /*
   * O que se repete é cobrado por mês, e `parcelas` divide o valor do período.
   * Um trimestral de R$ 1.980 em três parcelas cobra R$ 660 por mês; o mesmo
   * trimestral em uma parcela cobra tudo no primeiro mês, que é como um estúdio
   * vende "três meses à vista".
   */
  const previstas: CobrancaPrevista[] = []
  const meses = MESES[c.recorrencia] ?? 1
  const parcelas = Math.max(1, Math.min(c.parcelas, meses))
  const porParcela = valorDaParcela(c.precoAplicadoCent, parcelas)

  let competencia = competenciaDe(c.inicio)
  let primeira = true
  let indiceNoCiclo = 0

  while (competencia <= ateCompetencia) {
    // o contrato acabou: a competência seguinte ao fim não é devida, e quem
    // encerrou no meio do mês já deve o mês inteiro
    if (c.fim && competencia > competenciaDe(c.fim)) break

    if (indiceNoCiclo < parcelas && !mesTrancado(competencia, c.pausas)) {
      previstas.push({
        competencia,
        // a primeira nunca vence antes de o contrato começar: contrato
        // assinado no dia 20 com vencimento no dia 5 não nasce atrasado
        vencimento: maisTarde(vencimentoDa(competencia, c.diaVencimento),
          primeira ? c.inicio : competencia),
        valorCent: porParcela[indiceNoCiclo],
      })
      primeira = false
    }

    competencia = proximaCompetencia(competencia)
    indiceNoCiclo = (indiceNoCiclo + 1) % meses
  }

  return previstas
}

export type SituacaoCobranca = 'aberta' | 'parcial' | 'paga' | 'cancelada' | 'atrasada'

/**
 * Como está uma cobrança, hoje.
 *
 * "Atrasada" não é coluna e não sai da view: ela depende do dia de hoje no fuso
 * da conta, e `current_date` no banco é o fuso do servidor, que é outro. Quem
 * sabe o dia de hoje da conta é `src/server`, e por isso `hoje` entra aqui como
 * argumento.
 */
export function situacaoDaCobranca(
  c: { situacao: string; vencimento: string }, hoje: string,
): SituacaoCobranca {
  if (c.situacao === 'cancelada') return 'cancelada'
  if (c.situacao === 'paga') return 'paga'
  if (c.vencimento < hoje) return 'atrasada'
  return c.situacao === 'parcial' ? 'parcial' : 'aberta'
}

/** Há quantos dias venceu, ou zero enquanto não venceu. */
export function diasDeAtraso(vencimento: string, hoje: string): number {
  const dias = (paraData(hoje).getTime() - paraData(vencimento).getTime()) / DIA
  return Math.max(0, Math.round(dias))
}

const MESES_POR_EXTENSO = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

/**
 * A frase da competência, escrita como a recepção fala.
 *
 * "setembro de 2026", e não "2026-09-01". A competência aparece no telefone, na
 * linha da tela e no recibo, e as três precisam dizer o mesmo.
 */
export function competenciaPorExtenso(competencia: string): string {
  const mes = MESES_POR_EXTENSO[Number(competencia.slice(5, 7)) - 1]
  return `${mes} de ${competencia.slice(0, 4)}`
}

/** A competência curta, para caber na linha: `set/26`. */
export function competenciaCurta(competencia: string): string {
  const mes = MESES_POR_EXTENSO[Number(competencia.slice(5, 7)) - 1]
  return `${mes.slice(0, 3)}/${competencia.slice(2, 4)}`
}
