import type { Instrumentation } from 'next'

/**
 * O gancho que o Next chama quando algo do servidor levanta erro.
 *
 * É o único lugar que enxerga **tudo**: erro de Server Component, de ação de
 * servidor, de rota. Sem ele, cada um desses caminhos precisaria de um `try` que
 * alguém um dia esquece, e o esquecimento não aparece em teste, porque teste
 * exercita o caminho que funciona.
 *
 * Só roda no servidor Node. Ele não substitui o `console.error`, que continua
 * indo para o log da Vercel com a pilha inteira: o e-mail é o que faz alguém
 * olhar o log.
 */
export const onRequestError: Instrumentation.onRequestError = async (
  erro, pedido, contexto,
) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { avisarErro } = await import('./server/alerta')
  const onde = `${contexto.routerKind === 'App Router' ? '' : 'pages '}${pedido.path}`
  await avisarErro(onde.trim(), erro)
}
