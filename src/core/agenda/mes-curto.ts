const MESES = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
]

/**
 * `2024-03-01` → `mar/24`.
 *
 * A vigência de uma série é sempre lida como época, nunca como dia: "desde
 * março de 24" é o que responde "isso é antigo?". O dia exato só importa no
 * dia em que se encerra, e aí ele está no formulário.
 */
export function mesCurto(data: string): string {
  const mes = Number(data.slice(5, 7)) - 1
  return `${MESES[mes] ?? '?'}/${data.slice(2, 4)}`
}
