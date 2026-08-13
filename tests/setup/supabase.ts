import { execSync } from 'node:child_process'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/** Lê as chaves do Supabase local em vez de fixá-las: a CLI pode mudá-las. */
function ambiente(): Record<string, string> {
  const saida = execSync('npx supabase status -o env', { encoding: 'utf8' })
  const env: Record<string, string> = {}
  for (const linha of saida.split('\n')) {
    const m = linha.match(/^([A-Z0-9_]+)="?([^"]*)"?$/)
    if (m) env[m[1]] = m[2]
  }
  return env
}

const env = ambiente()
export const URL = env.API_URL ?? 'http://127.0.0.1:56421'
export const CHAVE_ANON = env.ANON_KEY
export const CHAVE_ADMIN = env.SERVICE_ROLE_KEY

export function admin(): SupabaseClient {
  return createClient(URL, CHAVE_ADMIN, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Cria um usuário confirmado e devolve um cliente autenticado como ele. */
export async function comoUsuario(email: string, senha = 'senha-de-teste-123') {
  const a = admin()
  const { data, error } = await a.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  })
  if (error) throw error

  const cliente = createClient(URL, CHAVE_ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error: erroLogin } = await cliente.auth.signInWithPassword({
    email,
    password: senha,
  })
  if (erroLogin) throw erroLogin

  return { cliente, usuarioId: data.user!.id }
}
