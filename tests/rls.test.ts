import { describe, it, expect, beforeAll } from 'vitest'
import { admin, comoUsuario } from './setup/supabase'

describe('isolamento entre contas', () => {
  let contaA: string
  let contaB: string
  let clienteA: Awaited<ReturnType<typeof comoUsuario>>['cliente']

  beforeAll(async () => {
    const a = admin()
    const marca = Date.now()

    const { data: cA } = await a.from('conta')
      .insert({ nome: 'Estúdio A', slug: `a-${marca}` }).select().single()
    const { data: cB } = await a.from('conta')
      .insert({ nome: 'Salão B', slug: `b-${marca}` }).select().single()
    contaA = cA!.id
    contaB = cB!.id

    const usuarioA = await comoUsuario(`dono-a-${marca}@teste.local`)
    clienteA = usuarioA.cliente
    await a.from('usuario_conta').insert({
      usuario_id: usuarioA.usuarioId, conta_id: contaA, papel: 'dono',
    })

    await a.from('vocabulario').insert([
      { conta_id: contaA, chave: 'pessoa', singular: 'Aluno',   plural: 'Alunos' },
      { conta_id: contaB, chave: 'pessoa', singular: 'Cliente', plural: 'Clientes' },
    ])
  })

  it('o usuário enxerga a conta dele', async () => {
    const { data } = await clienteA.from('conta').select('id')
    expect(data?.map((c) => c.id)).toEqual([contaA])
  })

  it('o usuário NÃO enxerga a conta do outro', async () => {
    const { data } = await clienteA.from('conta').select('id').eq('id', contaB)
    expect(data).toEqual([])
  })

  it('o vocabulário do outro não vaza', async () => {
    const { data } = await clienteA.from('vocabulario').select('singular')
    expect(data?.map((v) => v.singular)).toEqual(['Aluno'])
  })

  it('escrever na conta do outro é recusado', async () => {
    const { data } = await clienteA.from('vocabulario')
      .insert({ conta_id: contaB, chave: 'servico', singular: 'X', plural: 'Xs' })
      .select()
    expect(data).toBeNull()
  })

  it('quem não está em conta nenhuma não enxerga nada', async () => {
    const { cliente } = await comoUsuario(`avulso-${Date.now()}@teste.local`)
    const { data } = await cliente.from('conta').select('id')
    expect(data).toEqual([])
  })

  it('pessoa não vaza entre contas', async () => {
    const a = admin()
    await a.from('pessoa').insert([
      { conta_id: contaA, nome: 'Helena da conta A' },
      { conta_id: contaB, nome: 'Otávio da conta B' },
    ])
    const { data } = await clienteA.from('pessoa').select('nome')
    expect(data?.map((p) => p.nome)).toEqual(['Helena da conta A'])
  })

  it('pessoa sem telefone é aceita — 30% do dado real não tem', async () => {
    const { data, error } = await clienteA.from('pessoa')
      .insert({ conta_id: contaA, nome: 'Só o nome' }).select().single()
    expect(error).toBeNull()
    expect(data?.telefone).toBeNull()
  })
})
