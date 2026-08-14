/**
 * Cria o primeiro usuário da 4YU numa instalação nova.
 *
 * É operação de instalação, não tela: o produto não tem como criar o primeiro
 * suporte sozinho — para ver `/contas-4yu` é preciso já ser suporte. A conta
 * interna vem da migration `0040`; aqui entra só o usuário e o vínculo.
 *
 *   node scripts/bootstrap-suporte.mjs alguem@4yu.com.br [senha]
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const [email, senha = 'senha-de-teste-123'] = process.argv.slice(2)
if (!email?.includes('@')) {
  console.error('uso: node scripts/bootstrap-suporte.mjs <e-mail> [senha]')
  process.exit(1)
}

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').trim().split('\n')
    .map((l) => l.split(/=(.*)/s).slice(0, 2)),
)
// repetido em vez de importado: `.mjs` não lê o `esquema.ts`. Se mudar aqui,
// mude em `src/server/esquema.ts` também.
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: 'app_verandi' },
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: conta } = await db.from('conta')
  .select('id, nome').eq('interna', true).maybeSingle()
if (!conta) {
  console.error('não há conta interna: rode as migrations antes (0040)')
  process.exit(1)
}

const { data: existentes } = await db.auth.admin.listUsers()
const achado = existentes.users.find((u) => u.email === email)
const id = achado?.id ?? (await db.auth.admin.createUser({
  email, password: senha, email_confirm: true,
})).data.user.id

const { error } = await db.from('usuario_conta').upsert(
  { usuario_id: id, conta_id: conta.id, papel: 'suporte', ativo: true },
  { onConflict: 'usuario_id,conta_id' },
)
if (error) { console.error(error); process.exit(1) }

console.log(`${email} é suporte da 4YU (conta interna ${conta.id})`)
