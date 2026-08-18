import { describe, it, expect, beforeAll } from 'vitest'
import { admin } from './setup/supabase'

/**
 * O que só o banco responde: o código repetido, o isolamento entre contas e o
 * pacote sem quantidade.
 *
 * O preço aplicado não está aqui de propósito: é regra de produto, não de
 * banco, e mora em `tests/unit/planos.test.ts`. O filtro por papel também não:
 * "dono" é linha em `usuario_conta` e quem o lê é `src/server`.
 */
describe('plano no banco', () => {
  const db = admin()
  let contaA: string, contaB: string, servicoA: string, servicoB: string

  beforeAll(async () => {
    const m = Date.now()
    const { data: a } = await db.from('conta')
      .insert({ nome: 'Estúdio A', slug: `pl-a-${m}` }).select().single()
    const { data: b } = await db.from('conta')
      .insert({ nome: 'Estúdio B', slug: `pl-b-${m}` }).select().single()
    contaA = a!.id
    contaB = b!.id

    const { data: sa } = await db.from('servico')
      .insert({ conta_id: contaA, nome: 'Pilates aparelho' }).select().single()
    const { data: sb } = await db.from('servico')
      .insert({ conta_id: contaB, nome: 'Pilates aparelho' }).select().single()
    servicoA = sa!.id
    servicoB = sb!.id
  })

  it('o mesmo código não entra duas vezes na mesma conta', async () => {
    const base = {
      conta_id: contaA, servico_id: servicoA, recorrencia: 'mensal',
      preco_vinculado_cent: 45000, preco_avulso_cent: 45000,
    }
    const primeiro = await db.from('plano')
      .insert({ ...base, codigo: '001', nome: 'Mensal 1x por semana' })
    expect(primeiro.error).toBeNull()

    const repetido = await db.from('plano')
      .insert({ ...base, codigo: '001', nome: 'Outro plano qualquer' })
    expect(repetido.error?.code).toBe('23505')
  })

  it('o mesmo código vale em contas diferentes', async () => {
    const { error } = await db.from('plano').insert({
      conta_id: contaB, servico_id: servicoB, codigo: '001',
      nome: 'Mensal 1x por semana', recorrencia: 'mensal',
      preco_vinculado_cent: 45000, preco_avulso_cent: 45000,
    })
    expect(error).toBeNull()
  })

  it('pacote sem quantidade de sessões é recusado', async () => {
    const { error } = await db.from('plano').insert({
      conta_id: contaA, servico_id: servicoA, codigo: '900',
      nome: 'Pacote sem número', recorrencia: 'pacote',
      preco_vinculado_cent: 100000, preco_avulso_cent: 100000,
    })
    expect(error).not.toBeNull()
  })

  it('recorrência que ninguém definiu não entra', async () => {
    const { error } = await db.from('plano').insert({
      conta_id: contaA, servico_id: servicoA, codigo: '901',
      nome: 'Quinzenal', recorrencia: 'quinzenal',
      preco_vinculado_cent: 1000, preco_avulso_cent: 1000,
    })
    expect(error).not.toBeNull()
  })

  it('apagar a modalidade não leva junto o preço pelo qual ela foi vendida', async () => {
    const { data: s } = await db.from('servico')
      .insert({ conta_id: contaA, nome: 'Modalidade a apagar' }).select().single()
    await db.from('plano').insert({
      conta_id: contaA, servico_id: s!.id, codigo: '902', nome: 'Plano dela',
      recorrencia: 'avulsa', preco_vinculado_cent: 9000, preco_avulso_cent: 9000,
    })

    const { error } = await db.from('servico').delete().eq('id', s!.id)
    expect(error?.code).toBe('23503')
  })

  it('a turma não aceita dois números iguais na mesma conta', async () => {
    const serie = {
      conta_id: contaA, servico_id: servicoA, dia_semana: 1,
      hora_inicio: '07:00', duracao_min: 60, capacidade: 6,
      vigencia_inicio: '2026-01-01',
    }
    const um = await db.from('serie').insert({ ...serie, codigo: '001' })
    expect(um.error).toBeNull()
    const dois = await db.from('serie').insert({ ...serie, codigo: '001' })
    expect(dois.error?.code).toBe('23505')
  })

  it('turma sem número continua entrando, quantas forem', async () => {
    const serie = {
      conta_id: contaA, servico_id: servicoA, dia_semana: 2,
      hora_inicio: '08:00', duracao_min: 60, capacidade: 6,
      vigencia_inicio: '2026-01-01',
    }
    expect((await db.from('serie').insert(serie)).error).toBeNull()
    expect((await db.from('serie').insert(serie)).error).toBeNull()
  })
})
