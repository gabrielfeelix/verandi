import type { Recorrencia } from '@/core/planos/plano'

/**
 * As contas do contrato: até quando vale, quanto ele andou por causa de pausa,
 * quanto sobrou do pacote e quando vence.
 *
 * Sem banco e sem tela, como o resto de `core/`: a matrícula, a ficha e um dia
 * a API precisam das mesmas respostas, e conta repetida em três lugares diverge
 * no dia em que só dois deles forem corrigidos.
 *
 * Data aqui é sempre `YYYY-MM-DD` e a aritmética passa por UTC. `new Date` sem
 * o `T00:00:00Z` é lido no fuso da máquina, e no Brasil isso volta um dia.
 */

const DIA = 86_400_000

const paraData = (iso: string): Date => new Date(`${iso}T00:00:00Z`)
const paraIso = (d: Date): string => d.toISOString().slice(0, 10)

/** Meses somados sem escorregar: 31/01 mais um mês é 28/02, não 03/03. */
function somarMeses(iso: string, meses: number): string {
  const d = paraData(iso)
  const dia = d.getUTCDate()
  const alvo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + meses, 1))
  const ultimoDoMes = new Date(Date.UTC(
    alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate()
  alvo.setUTCDate(Math.min(dia, ultimoDoMes))
  return paraIso(alvo)
}

const somarDias = (iso: string, dias: number): string =>
  paraIso(new Date(paraData(iso).getTime() + dias * DIA))

/**
 * O último dia coberto por um contrato que dura `meses` a partir de `inicio`.
 *
 * Normalmente é a véspera do aniversário: começou em 01/09, três meses cobrem
 * setembro, outubro e novembro, e o fim é 30/11.
 *
 * A exceção é o mês curto. Um contrato que começa em 31/01 tem aniversário em
 * 30/04, porque abril não tem 31; tirar mais um dia dali entregaria 29/04 e
 * cobraria três meses para entregar dois meses e vinte e nove dias. Quando o
 * aniversário já foi encurtado, ele **é** o último dia.
 */
function ultimoDiaCoberto(inicio: string, meses: number): string {
  const aniversario = somarMeses(inicio, meses)
  const encurtou = paraData(aniversario).getUTCDate() !== paraData(inicio).getUTCDate()
  return encurtou ? aniversario : somarDias(aniversario, -1)
}

const MESES_DA_RECORRENCIA: Partial<Record<Recorrencia, number>> = {
  trimestral: 3,
  semestral: 6,
  anual: 12,
}

/**
 * Até quando o contrato vale, ou `null` quando não há fim previsto.
 *
 * O mensal renova sozinho e por isso não tem fim: dar a ele um fim de trinta
 * dias faria a recepção renovar à mão todo mês uma coisa que ninguém pediu para
 * acabar.
 *
 * O fim é o **dia anterior** ao aniversário: um trimestral que começa em 01/09
 * cobre setembro, outubro e novembro, e não um dia de dezembro.
 */
export function fimDoContrato(
  inicio: string,
  plano: { recorrencia: Recorrencia; validadeMeses: number | null },
): string | null {
  if (plano.recorrencia === 'avulsa') return inicio
  if (plano.recorrencia === 'pacote') {
    return plano.validadeMeses
      ? ultimoDiaCoberto(inicio, plano.validadeMeses)
      : null
  }
  const meses = MESES_DA_RECORRENCIA[plano.recorrencia]
  if (!meses) return null
  return ultimoDiaCoberto(inicio, meses)
}

export type Pausa = { inicio: string; fim: string | null }

/**
 * Quantos dias o contrato ficou parado, com as duas pontas dentro.
 *
 * Pausa em aberto vale zero: enquanto não se sabe quando a pessoa volta, não se
 * sabe quantos dias devolver, e chutar aqui vira uma data errada na ficha.
 */
export function diasParados(pausas: Pausa[]): number {
  return pausas.reduce((total, p) => {
    if (!p.fim) return total
    const dias = (paraData(p.fim).getTime() - paraData(p.inicio).getTime()) / DIA
    return total + dias + 1
  }, 0)
}

/**
 * O fim depois de devolver os dias parados.
 *
 * É a coluna "Novo Venc" da planilha do cliente: quem trancou dois meses volta
 * e quer os dois meses de volta, e não perder o que já tinha pago.
 */
export function fimProrrogado(fim: string | null, pausas: Pausa[]): string | null {
  if (!fim) return null
  const dias = diasParados(pausas)
  return dias > 0 ? somarDias(fim, dias) : fim
}

/**
 * O que sobrou do pacote de dez sessões.
 *
 * O usado é **contado**, não guardado: contador que se atualiza a cada presença
 * diverge no dia em que alguém corrige uma chamada de ontem, e aí o saldo passa
 * a discordar da sala.
 */
export function saldoDoPacote(
  contratadas: number | null, usadas: number,
): { usadas: number; restantes: number; acabou: boolean } | null {
  if (contratadas === null) return null
  return {
    usadas,
    // nunca negativo: a recepção encaixa a décima primeira antes de renovar, e
    // "restam -1 sessões" não é frase que alguém escreve
    restantes: Math.max(0, contratadas - usadas),
    acabou: usadas >= contratadas,
  }
}

/**
 * A próxima data de cobrança, contada a partir de hoje.
 *
 * Dia 31 num mês de trinta cai no dia 30, e não escorrega para o mês seguinte:
 * quem escolheu o último dia do mês quis o último dia do mês.
 */
export function proximoVencimento(
  hoje: string, diaVencimento: number | null,
): string | null {
  if (!diaVencimento) return null
  const d = paraData(hoje)

  const noMes = (ano: number, mes: number): string => {
    const ultimo = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate()
    return paraIso(new Date(Date.UTC(ano, mes, Math.min(diaVencimento, ultimo))))
  }

  const desteMes = noMes(d.getUTCFullYear(), d.getUTCMonth())
  if (desteMes >= hoje) return desteMes
  return noMes(d.getUTCFullYear(), d.getUTCMonth() + 1)
}
