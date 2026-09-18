/**
 * Como se procura alguém pelo nome, num lugar só.
 *
 * A mesma normalização da coluna gerada `nome_busca` (migration 0034). Ela
 * precisa valer dos dois lados: o servidor monta o `like` com ela, e o modal de
 * encaixe filtra no navegador com ela. Duas cópias divergindo apareceriam como
 * um cadastro que o servidor acha e o navegador não — e ninguém procuraria o
 * defeito numa função de acento.
 */
export function semAcento(t: string): string {
  return t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

/** Quantos resultados cabem: a lista mora dentro de um modal, no balcão. */
export const RESULTADOS = 8

/**
 * Até quantos cadastros o navegador filtra sozinho.
 *
 * Acima disto a busca volta a ser do servidor: seiscentos nomes em memória são
 * instantâneos, dez mil não são, e nem cabem no celular da recepção.
 */
export const CANDIDATOS_EM_MEMORIA = 600

/**
 * Filtra pelo nome, do jeito que o servidor filtraria.
 *
 * `includes` e não prefixo porque o estúdio procura tanto por "cecilia" quanto
 * por "salzano": meio-nome é como se procura quem se conhece de vista.
 */
export function filtrarPorNome<T extends { nome: string }>(
  todos: T[], termo: string, limite = RESULTADOS,
): T[] {
  const alvo = semAcento(termo.trim())
  if (!alvo) return []
  return todos.filter((c) => semAcento(c.nome).includes(alvo)).slice(0, limite)
}
