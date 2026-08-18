/**
 * Aritmética de data em string ISO `YYYY-MM-DD`.
 *
 * Tudo aqui passa por UTC de propósito: o `core/` não conhece fuso. Quem
 * converte data local em instante absoluto é o `server/`, usando `conta.fuso`.
 *
 * O cuidado que parece paranoia e não é: `new Date('2026-03-01')` sem o
 * `T00:00:00Z` é interpretado no fuso da máquina, e no Brasil isso volta um
 * dia. Uma série de segunda passaria a gerar domingos.
 */
export function diaDaSemanaDe(dataIso: string): number {
  return new Date(`${dataIso}T00:00:00Z`).getUTCDay()
}

export function somarDias(dataIso: string, n: number): string {
  const d = new Date(`${dataIso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/**
 * `2026-07-13` vira `13/07/26`: data na tela é escrita como se lê.
 *
 * Mora aqui, e não em cada tela, porque a mesma data aparece na pendência, na
 * avaliação e no recibo. Duas cópias da mesma regra divergem no dia em que uma
 * delas passar a escrever o ano com quatro dígitos, e a tela fica com dois
 * formatos sem ninguém ter decidido isso.
 */
export function dataCurta(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`
}

/**
 * Os dias por extenso, na ordem que `getUTCDay` devolve.
 *
 * Vive aqui, e não numa tela, porque o servidor também escreve frase com eles:
 * "o número 001 já é da turma de Segunda às 07:00" é montado longe de qualquer
 * componente.
 */
export const DIAS_INTEIROS = [
  'Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado',
] as const
