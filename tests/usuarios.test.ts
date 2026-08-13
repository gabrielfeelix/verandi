import { describe, it, expect, beforeAll } from 'vitest'
import { createHash } from 'node:crypto'
import { admin, comoUsuario } from './setup/supabase'
import { listarConvites } from '@/server/usuarios/consultas'

/**
 * As ações dependem de `cookies()` e não rodam fora do Next — o caminho pela
 * tela está em `e2e/convite.spec.ts`. O que se prova aqui é o que o banco
 * garante sozinho, e o que a função `usuarios_da_conta` deixa ou não passar.
 */
describe('acesso à conta', () => {
  const db = admin()
  let contaA: string
  let contaB: string
  let dono: Awaited<ReturnType<typeof comoUsuario>>
  let recepcao: Awaited<ReturnType<typeof comoUsuario>>
  let deFora: Awaited<ReturnType<typeof comoUsuario>>

  beforeAll(async () => {
    const m = `${Date.now()}-usr`
    const { data: a } = await db.from('conta')
      .insert({ nome: 'Estúdio', slug: `usr-a-${m}` }).select().single()
    const { data: b } = await db.from('conta')
      .insert({ nome: 'Salão', slug: `usr-b-${m}` }).select().single()
    contaA = a!.id
    contaB = b!.id

    dono = await comoUsuario(`dono-${m}@teste.local`)
    recepcao = await comoUsuario(`recepcao-${m}@teste.local`)
    deFora = await comoUsuario(`fora-${m}@teste.local`)

    await db.from('usuario_conta').insert([
      { usuario_id: dono.usuarioId, conta_id: contaA, papel: 'dono' },
      { usuario_id: recepcao.usuarioId, conta_id: contaA, papel: 'recepcao' },
      { usuario_id: deFora.usuarioId, conta_id: contaB, papel: 'dono' },
    ])
  })

  it('o dono enxerga quem tem acesso, com e-mail', async () => {
    const { data } = await dono.cliente.rpc('usuarios_da_conta', { p_conta: contaA })
    const lista = (data ?? []) as unknown as { email: string }[]
    expect(lista.map((u) => u.email).sort()).toEqual(
      [dono.email, recepcao.email].sort(),
    )
  })

  it('recepção NÃO enxerga a lista de usuários', async () => {
    // a função é `security definer`: sem a checagem de papel dentro dela, ela
    // seria um vazamento de `auth.users` com cara de consulta inocente
    const { data } = await recepcao.cliente.rpc('usuarios_da_conta', { p_conta: contaA })
    expect((data ?? []) as unknown[]).toEqual([])
  })

  it('dono de outra conta não enxerga a lista desta', async () => {
    const { data } = await deFora.cliente.rpc('usuarios_da_conta', { p_conta: contaA })
    expect((data ?? []) as unknown[]).toEqual([])
  })

  it('o token do convite nunca é coluna — só o hash', async () => {
    // único por rodada: `token_hash` é UNIQUE, e o banco não é limpo entre elas
    const token = `token-em-claro-que-nao-pode-aparecer-${Date.now()}`
    const { error } = await db.from('convite').insert({
      conta_id: contaA, email: `hash-${Date.now()}@teste.local`,
      papel: 'profissional', tipo: 'acesso',
      token_hash: createHash('sha256').update(token).digest('hex'),
      expira_em: new Date(Date.now() + 864e5).toISOString(),
    })
    expect(error).toBeNull()

    const { data } = await db.from('convite').select('*').eq('conta_id', contaA)
    const texto = JSON.stringify(data)
    expect(texto).not.toContain(token)
    expect(texto).toContain(createHash('sha256').update(token).digest('hex'))
  })

  it('convite aceito sai da lista de pendentes', async () => {
    const { data: c } = await db.from('convite').insert({
      conta_id: contaA, email: `aceito-${Date.now()}@teste.local`,
      papel: 'recepcao', tipo: 'acesso',
      token_hash: `h-${Math.random()}`,
      expira_em: new Date(Date.now() + 864e5).toISOString(),
    }).select().single()

    expect((await listarConvites(db, contaA)).some((x) => x.id === c!.id)).toBe(true)

    await db.from('convite')
      .update({ aceito_em: new Date().toISOString() }).eq('id', c!.id)

    expect((await listarConvites(db, contaA)).some((x) => x.id === c!.id)).toBe(false)
  })

  it('pedir senha nova não esbarra num convite de acesso em aberto', async () => {
    // o índice de pendente vale só para `tipo = acesso`: são coisas diferentes
    const email = `dois-${Date.now()}@teste.local`
    const base = {
      conta_id: contaA, email, papel: 'profissional' as const,
      expira_em: new Date(Date.now() + 864e5).toISOString(),
    }
    const acesso = await db.from('convite')
      .insert({ ...base, tipo: 'acesso', token_hash: `a-${Math.random()}` })
    expect(acesso.error).toBeNull()

    const senha = await db.from('convite')
      .insert({ ...base, tipo: 'senha', token_hash: `s-${Math.random()}` })
    expect(senha.error).toBeNull()
  })

  it('convite expirado aparece marcado, não some', async () => {
    const { data: c } = await db.from('convite').insert({
      conta_id: contaA, email: `velho-${Date.now()}@teste.local`,
      papel: 'profissional', tipo: 'acesso',
      token_hash: `v-${Math.random()}`,
      expira_em: new Date(Date.now() - 864e5).toISOString(),
    }).select().single()

    const lista = await listarConvites(db, contaA)
    expect(lista.find((x) => x.id === c!.id)?.expirado).toBe(true)
  })
})
