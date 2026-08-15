import type { Database } from './banco.types'

/**
 * Atalhos para falar da forma de uma tabela.
 *
 * Moram **aqui** e não em `banco.types.ts` porque aquele arquivo é gerado: o
 * `npm run tipos` o reescreve inteiro, e o que estivesse escrito lá some sem
 * aviso. Já sumiu uma vez.
 *
 * `Atualizacao<'pessoa'>` é o pacote parcial que `update()` aceita. Serve para
 * as ações que montam a linha campo a campo ("se o telefone veio, entra"):
 * antes elas eram `Record<string, unknown>`, que aceita `telefne` com a mesma
 * alegria que `telefone`.
 */
type Tabelas = Database['app_verandi']['Tables']

export type Linha<T extends keyof Tabelas> = Tabelas[T]['Row']
export type Atualizacao<T extends keyof Tabelas> = Tabelas[T]['Update']
export type Insercao<T extends keyof Tabelas> = Tabelas[T]['Insert']
