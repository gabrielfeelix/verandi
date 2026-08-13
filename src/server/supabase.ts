import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type Db = SupabaseClient

/**
 * Cliente com a chave de serviço: ignora RLS. Só para trabalho de servidor que
 * não tem usuário associado — materialização, entregadores de evento, a API do
 * bot. Nunca exponha isto a uma rota que recebe pedido do navegador sem
 * verificar quem é.
 */
export function clienteAdmin(): Db {
  const url = process.env.SUPABASE_URL
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !chave) {
    throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias')
  }
  return createClient(url, chave, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
