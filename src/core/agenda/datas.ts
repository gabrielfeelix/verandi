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
