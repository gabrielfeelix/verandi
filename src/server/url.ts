/**
 * O endereço público do app, para montar link que sai daqui.
 *
 * A tela monta link com `window.location.origin` e acerta sempre. E-mail sai do
 * servidor, que não tem `window` — sem esta variável o convite chegaria com um
 * link quebrado, e o defeito só apareceria na caixa de entrada de outra pessoa.
 *
 * Em desenvolvimento o padrão serve; em produção a variável é obrigatória, e
 * falta dela é erro alto em vez de link errado saindo calado.
 */
export function urlDoApp(): string {
  const url = process.env.APP_URL
  if (url) return url.replace(/\/+$/, '')
  if (process.env.NODE_ENV === 'production') {
    throw new Error('APP_URL é obrigatória em produção, o link do e-mail sai dela')
  }
  return 'http://localhost:3000'
}
