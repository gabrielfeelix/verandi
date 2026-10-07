import { describe, it, expect, beforeAll } from 'vitest'
import { admin } from './setup/supabase'
import { devolverASessao, soltarDaSessao } from '@/server/agenda/soltar'

describe('aula cancelada pelo estúdio', () => {
  const db = admin()
  let contaId: string, sessaoId: string, outraId: string
  const part: Record<string, string> = {}

  beforeAll(async () => {
    const { data: c } = await db.from('conta')
      .insert({ nome: 'Estúdio', slug: `solta-${Date.now()}`, fuso: 'America/Sao_Paulo' })
      .select().single()
    contaId = c!.id
    const { data: s } = await db.from('servico')
      .insert({ conta_id: contaId, nome: 'Pilates' }).select().single()
    const sessoes = await db.from('sessao').insert([
      { conta_id: contaId, servico_id: s!.id, inicio: '2036-03-02T13:00:00Z', duracao_min: 60, capacidade: 4 },
      { conta_id: contaId, servico_id: s!.id, inicio: '2036-03-09T13:00:00Z', duracao_min: 60, capacidade: 4 },
    ]).select('id')
    sessaoId = sessoes.data![0].id
    outraId = sessoes.data![1].id

    for (const [nome, origem, status] of [
      ['fixa', 'recorrente', 'esperada'],
      ['avulsa', 'avulso', 'confirmada'],
      ['presente', 'recorrente', 'presente'],
      ['repoe', 'recorrente', 'esperada'],
    ] as const) {
      const { data: p } = await db.from('pessoa').insert({ conta_id: contaId, nome }).select().single()
      const { data: x } = await db.from('participacao').insert({
        conta_id: contaId, sessao_id: sessaoId, pessoa_id: p!.id, origem, status,
      }).select('id').single()
      part[nome] = x!.id
    }
  })

  const status = async (id: string) =>
    (await db.from('participacao').select('status').eq('id', id).single()).data!.status

  it('só avulsos, quando o horário fixo segue em outro lugar', async () => {
    expect(await soltarDaSessao(db, contaId, [sessaoId], { soAvulsos: true })).toBe(1)
    expect(await status(part.avulsa)).toBe('cancelada')
    expect(await status(part.fixa)).toBe('esperada')
  })

  it('todos com lugar, e o fato já escrito fica', async () => {
    expect(await soltarDaSessao(db, contaId, [sessaoId])).toBe(2)
    expect(await status(part.fixa)).toBe('cancelada')
    expect(await status(part.presente)).toBe('presente')
  })

  it('reabrir devolve o lugar, menos a quem já repôs', async () => {
    const { data: p } = await db.from('participacao').select('pessoa_id').eq('id', part.repoe).single()
    await db.from('participacao').insert({
      conta_id: contaId, sessao_id: outraId, pessoa_id: p!.pessoa_id,
      origem: 'reposicao', status: 'esperada', reposicao_de_id: part.repoe,
    })
    await devolverASessao(db, contaId, sessaoId)
    expect(await status(part.fixa)).toBe('esperada')
    expect(await status(part.avulsa)).toBe('esperada')
    expect(await status(part.repoe)).toBe('cancelada')
  })
})
