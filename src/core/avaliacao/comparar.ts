/**
 * O par de datas que a comparação abre.
 *
 * A primeira contra a última, e não as duas últimas: quem abre a comparação
 * quer ver o quanto andou desde que começou, e duas avaliações seguidas de três
 * meses mostram quase nada. Trocar qualquer uma das pontas é um clique.
 */
export function parPadrao(
  datas: readonly string[],
): { antes: string; depois: string } | null {
  if (datas.length < 2) return null
  const ordenadas = [...datas].sort()
  return { antes: ordenadas[0], depois: ordenadas[ordenadas.length - 1] }
}

/**
 * As datas em que aquela posição tem foto.
 *
 * A matriz mostra a posição em todas as visitas, e o buraco é informação: a
 * visita em que ninguém fotografou as costas precisa aparecer vazia, e não
 * sumir da linha, senão as colunas deixam de estar alinhadas com as datas.
 */
export function datasComFoto(
  avaliacoes: readonly { data: string; fotos: readonly { posicaoId: string }[] }[],
  posicaoId: string,
): string[] {
  return avaliacoes
    .filter((a) => a.fotos.some((f) => f.posicaoId === posicaoId))
    .map((a) => a.data)
}
