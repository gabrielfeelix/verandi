import type { Db } from '../supabase'
import type { Arranjo } from '@/core/home/blocos'

/**
 * O arranjo salvo da tela inicial, desta pessoa nesta conta.
 *
 * Mora fora de `acoes.ts` porque tudo que um arquivo `'use server'` exporta
 * vira endereço chamável de fora, e esta função recebe os identificadores
 * prontos. Mesma separação de `financeiro/materializar.ts`.
 *
 * Quem nunca mexeu não tem linha, e isso não é erro: devolve `null`, e
 * `arranjoEfetivo` monta o padrão. Uma linha gravada no primeiro acesso seria
 * escrita no banco em toda abertura de tela de quem nunca vai querer mudar
 * nada.
 */
export async function arranjoSalvo(
  db: Db, contaId: string, usuarioId: string,
): Promise<Arranjo[] | null> {
  const { data, error } = await db.from('preferencia_home')
    .select('blocos').eq('conta_id', contaId).eq('usuario_id', usuarioId)
    .maybeSingle()
  if (error) throw error
  if (!data?.blocos) return null

  /*
   * O `jsonb` vem do banco como `unknown`, e o que está lá foi escrito por uma
   * versão anterior da tela. Ler com cuidado aqui é o que permite `core/`
   * assumir a forma: linha sem `id` de texto é linha que não descreve bloco
   * nenhum, e cai fora antes de virar problema de quem desenha.
   */
  const bruto = data.blocos as unknown
  if (!Array.isArray(bruto)) return null
  return bruto
    .filter((l): l is { id: string; visivel?: unknown } =>
      typeof l === 'object' && l !== null && typeof (l as { id?: unknown }).id === 'string')
    .map((l) => ({ id: l.id, visivel: l.visivel !== false }))
}
