import { TERMOS } from './termos'
import { PRIVACIDADE } from './privacidade'
import type { Documento } from './comum'

export * from './comum'
export { TERMOS } from './termos'
export { PRIVACIDADE } from './privacidade'

/** Os documentos publicados, pelo pedaço que aparece na URL. */
export const DOCUMENTOS: Record<Documento['slug'], Documento> = {
  termos: TERMOS,
  privacidade: PRIVACIDADE,
}

/**
 * O par de links que vai no rodapé da tela e no pé do e-mail.
 *
 * Existe aqui para o dia em que entrar um terceiro documento: rodapé e e-mail
 * mudam juntos, sem ninguém precisar lembrar do segundo lugar.
 */
export const LINKS_LEGAIS = [
  { href: '/termos', rotulo: 'Termos de uso' },
  { href: '/privacidade', rotulo: 'Privacidade' },
] as const
