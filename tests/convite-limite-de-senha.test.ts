import { describe, it, expect, beforeAll, vi } from 'vitest'
import { createHash, randomBytes } from 'node:crypto'
import { admin, comoUsuario, URL, CHAVE_ANON, CHAVE_ADMIN } from './setup/supabase'

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/navigation', () => ({ redirect: () => { throw new Error('redirect') } }))

/**
 * O aceite confere a senha de quem já existe pelo servidor, então o limite do
 * Auth conta o IP da Vercel e não quem tenta. O limite próprio, por e-mail,
 * barra a sexta tentativa errada em quinze minutos, mesmo com a senha certa.
 */
describe('limite de senha no aceite de convite', () => {
  const a = admin()
  let email: string
  let token: string

  beforeAll(async () => {
    process.env.SUPABASE_URL = URL
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = CHAVE_ANON
    process.env.SUPABASE_SERVICE_ROLE_KEY = CHAVE_ADMIN
    const m = `${Date.now()}-lim`
    email = `alvo-${m}@teste.local`
    await comoUsuario(email)

    const { data: c } = await a.from('conta')
      .insert({ nome: 'Estúdio do limite', slug: `lim-${m}` }).select().single()
    token = randomBytes(24).toString('base64url')
    await a.from('convite').insert({
      conta_id: c!.id, email, papel: 'recepcao', tipo: 'acesso',
      token_hash: createHash('sha256').update(token).digest('hex'),
      expira_em: new Date(Date.now() + 864e5).toISOString(),
    })
  })

  it('a sexta tentativa é barrada, mesmo com a senha certa', async () => {
    const { aceitarConvite } = await import('@/server/usuarios/acoes')
    for (let i = 0; i < 5; i++) {
      await expect(aceitarConvite(token, `errada-${i}-123`, 'Alvo')).rejects.toThrow('senha não confere')
    }
    await expect(aceitarConvite(token, 'senha-de-teste-123', 'Alvo')).rejects.toThrow('muitas tentativas')
  })
})
