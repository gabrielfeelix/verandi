import { describe, it, expect, beforeAll } from 'vitest'
import { admin, comoUsuario } from './setup/supabase'
import { hashDe, novaChave } from '@/server/api/chave'

/**
 * A chave de API contra o banco de verdade.
 *
 * Uma chave alcança a agenda inteira de uma conta sem passar por papel: é a
 * credencial mais forte que um cliente emite. Os dois riscos são vazar entre
 * contas e continuar valendo depois de revogada, e é o que este arquivo cobre.
 */
describe('chave de API', () => {
  const a = admin()
  let contaA: string
  let contaB: string
  let dono: Awaited<ReturnType<typeof comoUsuario>>
  let recepcao: Awaited<ReturnType<typeof comoUsuario>>
  let donoDeB: Awaited<ReturnType<typeof comoUsuario>>
  let segredoDeA: string

  beforeAll(async () => {
    const marca = `${Date.now()}-api`

    const { data: cA } = await a.from('conta')
      .insert({ nome: 'Estúdio A', slug: `api-a-${marca}` }).select().single()
    const { data: cB } = await a.from('conta')
      .insert({ nome: 'Salão B', slug: `api-b-${marca}` }).select().single()
    contaA = cA!.id
    contaB = cB!.id

    dono = await comoUsuario(`api-dono-${marca}@teste.local`)
    recepcao = await comoUsuario(`api-rec-${marca}@teste.local`)
    donoDeB = await comoUsuario(`api-b-${marca}@teste.local`)

    await a.from('usuario_conta').insert([
      { usuario_id: dono.usuarioId, conta_id: contaA, papel: 'dono' },
      { usuario_id: recepcao.usuarioId, conta_id: contaA, papel: 'recepcao' },
      { usuario_id: donoDeB.usuarioId, conta_id: contaB, papel: 'dono' },
    ])

    const nova = novaChave()
    segredoDeA = nova.segredo
    await a.from('chave_api').insert({
      conta_id: contaA, nome: 'AutoFluxos', hash: nova.hash, prefixo: nova.prefixo,
    })
  })

  it('o dono enxerga a chave da conta dele', async () => {
    const { data } = await dono.cliente.from('chave_api').select('nome')
      .eq('conta_id', contaA)
    expect(data).toEqual([{ nome: 'AutoFluxos' }])
  })

  it('o dono de outra conta não enxerga nada', async () => {
    const { data } = await donoDeB.cliente.from('chave_api').select('id')
    expect(data).toEqual([])
  })

  /*
   * A recepção não vê, e a razão não é hierarquia: a chave alcança a agenda
   * inteira sem passar por papel, então mostrá-la a quem opera é entregar uma
   * credencial mais forte do que o próprio acesso da pessoa. Mesma decisão do
   * botão de anonimizar.
   */
  it('a recepção não enxerga chave nenhuma, nem da própria conta', async () => {
    const { data } = await recepcao.cliente.from('chave_api').select('id')
    expect(data).toEqual([])
  })

  it('a recepção não cria chave', async () => {
    const nova = novaChave()
    const { error } = await recepcao.cliente.from('chave_api').insert({
      conta_id: contaA, nome: 'pela porta dos fundos',
      hash: nova.hash, prefixo: nova.prefixo,
    })
    expect(error).not.toBeNull()
  })

  it('ninguém escreve chave na conta de outro', async () => {
    const nova = novaChave()
    const { error } = await donoDeB.cliente.from('chave_api').insert({
      conta_id: contaA, nome: 'invasora',
      hash: nova.hash, prefixo: nova.prefixo,
    })
    expect(error).not.toBeNull()
  })

  it('o segredo não fica no banco em lugar nenhum', async () => {
    const { data } = await a.from('chave_api').select('*').eq('conta_id', contaA)
    const tudo = JSON.stringify(data)
    expect(tudo).not.toContain(segredoDeA)
    // e o que está lá é o hash dele, que é como a busca acha a linha
    expect(tudo).toContain(hashDe(segredoDeA))
  })

  it('o hash é único: duas chaves não podem colidir no índice de busca', async () => {
    const { data: existente } = await a.from('chave_api')
      .select('hash').eq('conta_id', contaA).single()
    const { error } = await a.from('chave_api').insert({
      conta_id: contaB, nome: 'colisão', hash: existente!.hash, prefixo: 'vr_xxxxxxxx',
    })
    expect(error).not.toBeNull()
  })

  it('revogar não apaga: a linha fica com a data', async () => {
    const nova = novaChave()
    const { data: c } = await a.from('chave_api').insert({
      conta_id: contaA, nome: 'para revogar', hash: nova.hash, prefixo: nova.prefixo,
    }).select('id').single()

    await a.from('chave_api')
      .update({ revogada_em: new Date().toISOString() }).eq('id', c!.id)

    const { data } = await a.from('chave_api')
      .select('nome, revogada_em').eq('id', c!.id).single()
    expect(data!.nome).toBe('para revogar')
    expect(data!.revogada_em).not.toBeNull()
  })

  it('nome vazio não entra: revogar a chave certa depende dele', async () => {
    const nova = novaChave()
    const { error } = await a.from('chave_api').insert({
      conta_id: contaA, nome: '   ', hash: nova.hash, prefixo: nova.prefixo,
    })
    expect(error).not.toBeNull()
  })

  it('apagar a conta leva as chaves dela junto', async () => {
    const { data: c } = await a.from('conta')
      .insert({ nome: 'Efêmera', slug: `api-tmp-${Date.now()}` }).select().single()
    const nova = novaChave()
    await a.from('chave_api').insert({
      conta_id: c!.id, nome: 'some junto', hash: nova.hash, prefixo: nova.prefixo,
    })

    await a.from('conta').delete().eq('id', c!.id)

    const { count } = await a.from('chave_api')
      .select('*', { count: 'exact', head: true }).eq('hash', nova.hash)
    expect(count).toBe(0)
  })
})
