import { describe, it, expect, beforeAll } from 'vitest'
import { admin, comoUsuario } from './setup/supabase'

/**
 * Progresso de tutorial é da pessoa, e de mais ninguém.
 *
 * Nem o dono lê o da recepção: saber quem pulou o tutorial não ajuda a operar
 * nada, e transformaria a tabela em placar de quem aprendeu o sistema.
 */
describe('onboarding', () => {
  let contaId: string
  let dono: Awaited<ReturnType<typeof comoUsuario>>
  let recepcao: Awaited<ReturnType<typeof comoUsuario>>

  beforeAll(async () => {
    const a = admin()
    const marca = Date.now()

    const { data: c } = await a.from('conta')
      .insert({ nome: 'Estúdio do tutorial', slug: `tut-${marca}` }).select().single()
    contaId = c!.id

    dono = await comoUsuario(`dono-tut-${marca}@teste.local`)
    recepcao = await comoUsuario(`rec-tut-${marca}@teste.local`)
    await a.from('usuario_conta').insert([
      { usuario_id: dono.usuarioId, conta_id: contaId, papel: 'dono' },
      { usuario_id: recepcao.usuarioId, conta_id: contaId, papel: 'recepcao' },
    ])
  })

  it('cada pessoa grava o próprio progresso', async () => {
    const { error } = await dono.cliente.from('onboarding').insert({
      conta_id: contaId, usuario_id: dono.usuarioId,
      roteiro: 'primeiros-passos', passo: 2,
    })
    expect(error).toBeNull()

    const { data } = await dono.cliente.from('onboarding').select('passo')
    expect(data).toEqual([{ passo: 2 }])
  })

  it('o colega não enxerga o progresso alheio', async () => {
    const { data } = await recepcao.cliente.from('onboarding').select('passo')
    expect(data).toEqual([])
  })

  it('ninguém grava progresso no nome de outra pessoa', async () => {
    const { data } = await recepcao.cliente.from('onboarding').insert({
      conta_id: contaId, usuario_id: dono.usuarioId, roteiro: 'boas-vindas',
    }).select()
    expect(data).toBeNull()
  })

  it('o mesmo roteiro não vira duas linhas na mesma conta', async () => {
    const { error } = await dono.cliente.from('onboarding').insert({
      conta_id: contaId, usuario_id: dono.usuarioId, roteiro: 'primeiros-passos',
    })
    expect(error?.code).toBe('23505')
  })

  it('a mesma pessoa tem progresso próprio em cada conta', async () => {
    // ela é dona de um estúdio e professora em outro: ver o roteiro de dono não
    // ensina a operar o segundo
    const a = admin()
    const { data: outra } = await a.from('conta')
      .insert({ nome: 'Outro negócio', slug: `tut2-${Date.now()}` }).select().single()
    await a.from('usuario_conta').insert({
      usuario_id: dono.usuarioId, conta_id: outra!.id, papel: 'profissional',
    })

    const { error } = await dono.cliente.from('onboarding').insert({
      conta_id: outra!.id, usuario_id: dono.usuarioId, roteiro: 'primeiros-passos',
    })
    expect(error).toBeNull()
  })

  it('roteiro inventado é recusado pelo banco', async () => {
    const { error } = await dono.cliente.from('onboarding').insert({
      conta_id: contaId, usuario_id: dono.usuarioId, roteiro: 'qualquer-coisa',
    })
    expect(error).not.toBeNull()
  })

  it('anônimo não alcança a tabela', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    const { URL, CHAVE_ANON } = await import('./setup/supabase')
    const anon = createClient(URL, CHAVE_ANON, { db: { schema: 'app_verandi' } })
    const { data } = await anon.from('onboarding').select('id')
    expect(data ?? []).toEqual([])
  })
})
