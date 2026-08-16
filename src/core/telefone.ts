/**
 * Telefone sem DDD é telefone que não disca.
 *
 * A planilha de onde vem quase todo cadastro escreve o número do jeito que se
 * fala na recepção — "9.8109-1840" —, porque quem anota e quem liga moram na
 * mesma cidade. No sistema isso não se sustenta: o aviso de cancelamento sai
 * por WhatsApp, e o WhatsApp precisa do país e do DDD. Guardar nove dígitos é
 * guardar um número que ninguém consegue usar depois, e não há como adivinhar
 * o DDD — 44, 41, 55 e 11 são todos plausíveis para o mesmo cadastro.
 *
 * Por isso o DDD é obrigatório na hora de salvar, e o campo o cobra na cara,
 * em vez de aceitar e falhar meses depois na hora de avisar alguém.
 */

/** Os DDDs que existem no Brasil. Fora desta lista, é dígito trocado. */
const DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19,
  21, 22, 24, 27, 28,
  31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55,
  61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79,
  81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
])

export const soDigitos = (v: string): string => v.replace(/\D/g, '')

/**
 * `(44) 99999-9999` enquanto se digita, sem exigir que a pessoa digite os
 * parênteses. Aceita o número incompleto: a máscara acompanha, não trava.
 */
export function mascararTelefone(bruto: string): string {
  const n = soDigitos(bruto).slice(0, 11)
  if (n.length <= 2) return n
  if (n.length <= 6) return `(${n.slice(0, 2)}) ${n.slice(2)}`
  if (n.length <= 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`
  return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`
}

/**
 * O que está errado no número, ou `null` quando está certo.
 *
 * Vazio é válido: 30% dos cadastros reais não têm telefone, e exigir um é o
 * jeito mais rápido de fazer a recepção inventar número.
 */
export function erroDoTelefone(bruto: string | null | undefined): string | null {
  const n = soDigitos(bruto ?? '')
  if (!n) return null

  if (n.length === 8 || n.length === 9) {
    // com nove dígitos não dá para saber se falta o DDD ou um dígito do
    // número; a mensagem diz as duas coisas em vez de chutar uma
    return 'Faltou o DDD. Com ele são 10 dígitos no fixo e 11 no celular: (44) 99999-9999.'
  }
  if (n.length !== 10 && n.length !== 11) {
    return 'Número incompleto. Com DDD são 10 dígitos no fixo e 11 no celular.'
  }
  if (!DDDS.has(Number(n.slice(0, 2)))) {
    return `${n.slice(0, 2)} não é um DDD que existe. Confira os dois primeiros dígitos.`
  }
  // celular brasileiro ganhou o nono dígito em 2016, e ele é sempre 9
  if (n.length === 11 && n[2] !== '9') {
    return 'Celular com 11 dígitos começa com 9 depois do DDD.'
  }
  return null
}

export const telefoneValido = (bruto: string | null | undefined): boolean =>
  erroDoTelefone(bruto) === null

/** O que vai para o banco: só dígitos, ou `null` quando não há telefone. */
export function normalizarTelefone(bruto: string | null | undefined): string | null {
  return soDigitos(bruto ?? '') || null
}
