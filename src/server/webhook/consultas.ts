import { clienteAdmin } from '../supabase'

/**
 * Para onde a conta é avisada, sem o segredo.
 *
 * Lê com a chave de serviço porque a tabela não tem política, e devolve só o que
 * a tela mostra: o segredo não volta nem para o dono, e é isso que faz o
 * "aparece uma vez" ser verdade.
 */
export type AvisoDaConta = { url: string; ativo: boolean } | null

export async function avisoDaConta(contaId: string): Promise<AvisoDaConta> {
  const { data } = await clienteAdmin()
    .from('webhook').select('url, ativo').eq('conta_id', contaId).maybeSingle()
  return data ? { url: data.url, ativo: data.ativo } : null
}
