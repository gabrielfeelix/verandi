import { cache } from 'react'
import { PADRAO, type ChaveVocabulario, type Vocabulario } from '@/core/vocabulario/padrao'
import { rotulo } from '@/core/vocabulario/rotulo'
import type { Db } from './supabase'

type LinhaVocabulario = { chave: ChaveVocabulario; singular: string; plural: string }

/**
 * O vocabulário da conta, memoizado por requisição.
 *
 * `cache` do React garante que quinze componentes pedindo o rótulo de "pessoa"
 * na mesma renderização façam uma consulta só.
 */
export const carregarVocabulario = cache(
  async (db: Db, contaId: string): Promise<Vocabulario> => {
    const { data } = await db
      .from('vocabulario')
      .select('chave, singular, plural')
      .eq('conta_id', contaId)
      .returns<LinhaVocabulario[]>()

    const voc: Vocabulario = {}
    for (const l of data ?? []) voc[l.chave] = { singular: l.singular, plural: l.plural }
    return voc
  },
)

/**
 * Os rótulos já resolvidos, prontos para descer como props para componentes
 * burros. Nenhum componente deve importar `PADRAO` direto.
 */
export type Rotulos = Record<ChaveVocabulario, { singular: string; plural: string }>

export function resolverRotulos(voc: Vocabulario): Rotulos {
  const saida = {} as Rotulos
  for (const chave of Object.keys(PADRAO) as ChaveVocabulario[]) {
    saida[chave] = {
      singular: rotulo(voc, chave, 'singular'),
      plural: rotulo(voc, chave, 'plural'),
    }
  }
  return saida
}
