import { PARES_AVATAR } from './tintas'

/**
 * O quadradinho com a sigla da conta.
 *
 * Mesma conta, mesma cor, em qualquer máquina: é o que faz reconhecer de
 * relance em qual empresa se está, no seletor do rail e na tela de `/contas`.
 */
export function tileDe(nome: string) {
  let soma = 0
  for (const c of nome) soma = (soma + c.codePointAt(0)!) % 997
  const [fundo, frente] = PARES_AVATAR[soma % PARES_AVATAR.length]
  const sigla = nome
    .trim().split(/\s+/).slice(0, 2)
    .map((p) => p[0] ?? '')
    .join('')
    .toUpperCase()
  return { fundo, frente, sigla }
}
