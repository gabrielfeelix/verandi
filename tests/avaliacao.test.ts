import { describe, it, expect, beforeAll } from 'vitest'
import { admin } from './setup/supabase'
import { limparAvaliacoesDaPessoa } from '@/server/avaliacao/registro'

/**
 * O que só o banco responde: isolamento entre contas, a unicidade da posição
 * dentro da visita, e a exclusão que precisa levar as imagens junto.
 *
 * O filtro por papel não está aqui de propósito: ele mora em `src/server` e é
 * testado por `podeVerAvaliacao`, em `tests/unit/avaliacao.test.ts`. Papel do
 * produto é linha em `usuario_conta`, não papel do Postgres.
 */
describe('avaliação no banco', () => {
  const db = admin()
  let contaA: string, contaB: string, pessoaA: string, avaliacaoA: string, posicaoA: string

  beforeAll(async () => {
    const m = Date.now()
    const { data: a } = await db.from('conta')
      .insert({ nome: 'Estúdio A', slug: `av-a-${m}` }).select().single()
    const { data: b } = await db.from('conta')
      .insert({ nome: 'Estúdio B', slug: `av-b-${m}` }).select().single()
    contaA = a!.id
    contaB = b!.id

    const { data: p } = await db.from('pessoa')
      .insert({ conta_id: contaA, nome: 'Marina Ferraz', ativo: true }).select().single()
    pessoaA = p!.id

    const { data: pos } = await db.from('posicao_avaliacao')
      .insert({ conta_id: contaA, nome: 'Frente', ordem: 1 }).select().single()
    posicaoA = pos!.id

    const { data: av } = await db.from('avaliacao')
      .insert({ conta_id: contaA, pessoa_id: pessoaA, data: '2026-08-18' })
      .select().single()
    avaliacaoA = av!.id
  })

  it('a mesma posição não entra duas vezes na mesma visita', async () => {
    const linha = {
      conta_id: contaA, avaliacao_id: avaliacaoA, posicao_id: posicaoA,
      path: `${contaA}/${pessoaA}/${avaliacaoA}/${posicaoA}.jpg`,
    }
    const primeira = await db.from('avaliacao_foto').insert(linha)
    expect(primeira.error).toBeNull()

    const segunda = await db.from('avaliacao_foto').insert(linha)
    expect(segunda.error?.code).toBe('23505')
  })

  it('a posição em uso não pode ser apagada, para a matriz não ficar com coluna órfã', async () => {
    const r = await db.from('posicao_avaliacao').delete().eq('id', posicaoA)
    expect(r.error?.code).toBe('23503')
  })

  it('a conta vizinha não tem posição com o mesmo nome bloqueada', async () => {
    const r = await db.from('posicao_avaliacao')
      .insert({ conta_id: contaB, nome: 'Frente', ordem: 1 })
    expect(r.error).toBeNull()
  })

  it('apagar a visita leva as fotos dela junto', async () => {
    await db.from('avaliacao').delete().eq('id', avaliacaoA)
    const { data } = await db.from('avaliacao_foto').select('id').eq('avaliacao_id', avaliacaoA)
    expect(data).toEqual([])
  })

  it('a exclusão a pedido do titular não deixa avaliação para trás', async () => {
    const { data: av } = await db.from('avaliacao')
      .insert({ conta_id: contaA, pessoa_id: pessoaA, data: '2026-08-19' })
      .select().single()
    expect(av).not.toBeNull()

    await limparAvaliacoesDaPessoa(db, contaA, pessoaA)

    const { data } = await db.from('avaliacao').select('id').eq('pessoa_id', pessoaA)
    expect(data).toEqual([])
  })
})
