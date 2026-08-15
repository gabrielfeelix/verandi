import { createClient } from '@supabase/supabase-js'
import { ESQUEMA } from './esquema'
import type { Database } from './banco.types'

/*
 * `Db` sai do que `createClient` devolve, em vez de ser escrito à mão.
 *
 * `SupabaseClient` sem parâmetro assume o schema `public`, e a Verandi vive em
 * `app_verandi` — escrito à mão, todo lugar que recebe um cliente passava a
 * recusá-lo por tipo. Inferir também sobrevive à próxima versão do
 * supabase-js mudar a quantidade de genéricos, que já mudou antes.
 *
 * `Database` é o arquivo gerado por `npm run tipos`. Com ele, `db.from('pesoa')`
 * e `.eq('observacao_vsivel', x)` param de compilar; sem ele, o supabase-js
 * devolvia `GenericStringError` e cada consulta declarava o próprio formato à
 * mão, sem nada conferindo que ele batia com o banco.
 */
function criaCliente(url: string, chave: string) {
  return createClient<Database, { PostgrestVersion: '12' }>(url, chave, {
    db: { schema: ESQUEMA },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export type Db = ReturnType<typeof criaCliente>

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
  return criaCliente(url, chave)
}
