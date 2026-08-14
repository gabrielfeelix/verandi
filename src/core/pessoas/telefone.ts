/**
 * O telefone como a lista mostra: **mascarado no meio**.
 *
 * `(11) 9••••-3312` em vez de `11999103312`. A tela de pessoas fica aberta num
 * balcão, de frente para quem chega; o número inteiro de trinta alunas exposto
 * o dia todo é dado pessoal de gente que não está na sala. O fim basta para
 * conferir "é esse mesmo?", e quem precisa do número tem o botão de copiar na
 * ficha, que copia o valor cru.
 *
 * Devolve `null` quando não há número — é a diferença entre "não cadastrou" e
 * "cadastrou errado", e as duas aparecem diferentes na tela.
 */
export function telefoneMascarado(bruto: string | null | undefined): string | null {
  if (!bruto) return null
  const d = bruto.replace(/\D/g, '')
  if (d.length === 0) return null
  if (d.length < 6) return d

  const fim = d.slice(-4)
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d[2]}••••-${fim}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ••••-${fim}`
  return `${'•'.repeat(Math.max(2, d.length - 4))}-${fim}`
}
