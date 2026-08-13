import { PADRAO, type ChaveVocabulario, type Vocabulario } from './padrao'

export function rotulo(
  voc: Vocabulario,
  chave: ChaveVocabulario,
  forma: 'singular' | 'plural' = 'singular',
): string {
  return voc[chave]?.[forma] ?? PADRAO[chave][forma]
}
