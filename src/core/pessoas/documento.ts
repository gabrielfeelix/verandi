/**
 * CPF.
 *
 * Ele entra na ficha por causa do recibo: documento de pagamento sem o
 * documento de quem pagou não serve para nada, e o erro de digitação só
 * aparece na hora de emitir, com a pessoa já de saída.
 *
 * Continua opcional. Quem cadastra na correria não tem o documento em mãos, e
 * exigir é o jeito mais rápido de a recepção inventar número.
 */

export const soDigitosCpf = (v: string): string => v.replace(/\D/g, '')

/** `390.533.447-05` enquanto se digita: acompanha, não trava. */
export function mascararCpf(bruto: string): string {
  const n = soDigitosCpf(bruto).slice(0, 11)
  if (n.length <= 3) return n
  if (n.length <= 6) return `${n.slice(0, 3)}.${n.slice(3)}`
  if (n.length <= 9) return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6)}`
  return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9)}`
}

/**
 * O dígito verificador fecha?
 *
 * Os onze dígitos repetidos passam na conta e não são documento de ninguém:
 * `111.111.111-11` fecha a matemática, e é o valor que aparece quando alguém
 * quer só sair do campo.
 */
export function cpfValido(bruto: string | null | undefined): boolean {
  const n = soDigitosCpf(bruto ?? '')
  if (n.length !== 11) return false
  if (/^(\d)\1{10}$/.test(n)) return false

  const digito = (ate: number): number => {
    let soma = 0
    for (let i = 0; i < ate; i++) soma += Number(n[i]) * (ate + 1 - i)
    const r = (soma * 10) % 11
    return r === 10 ? 0 : r
  }

  return digito(9) === Number(n[9]) && digito(10) === Number(n[10])
}
