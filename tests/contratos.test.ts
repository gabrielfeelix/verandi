import { describe, it, expect, beforeAll } from 'vitest'
import { admin } from './setup/supabase'

/**
 * O que só o banco responde: a vaga que não se repete, o CPF que não se
 * duplica na conta, e o que sobrevive a apagar cada ponta.
 */
describe('contrato no banco', () => {
  const db = admin()
  let contaId: string, pessoaId: string, servicoId: string
  let planoId: string, serieId: string

  beforeAll(async () => {
    const m = Date.now()
    const { data: c } = await db.from('conta')
      .insert({ nome: 'Estúdio do contrato', slug: `ct-${m}` }).select().single()
    contaId = c!.id

    const { data: p } = await db.from('pessoa')
      .insert({ conta_id: contaId, nome: 'Marina Ferraz' }).select().single()
    pessoaId = p!.id

    const { data: s } = await db.from('servico')
      .insert({ conta_id: contaId, nome: 'Pilates aparelho' }).select().single()
    servicoId = s!.id

    const { data: pl } = await db.from('plano').insert({
      conta_id: contaId, servico_id: servicoId, codigo: '002',
      nome: 'Mensal, 2x por semana', recorrencia: 'mensal',
      frequencia_semanal: 2, preco_vinculado_cent: 73500,
      preco_avulso_cent: 73500,
    }).select().single()
    planoId = pl!.id

    const { data: se } = await db.from('serie').insert({
      conta_id: contaId, servico_id: servicoId, dia_semana: 1,
      hora_inicio: '07:00', duracao_min: 60, capacidade: 6,
      vigencia_inicio: '2026-01-01',
    }).select().single()
    serieId = se!.id
  })

  it('a mesma pessoa não ocupa a mesma turma duas vezes ao mesmo tempo', async () => {
    const vaga = {
      conta_id: contaId, serie_id: serieId, pessoa_id: pessoaId,
      inicio: '2026-09-01',
    }
    expect((await db.from('vaga').insert(vaga)).error).toBeNull()
    expect((await db.from('vaga').insert(vaga)).error?.code).toBe('23505')
  })

  it('mas volta a ocupar depois que a anterior terminou', async () => {
    // encerrar a vaga é `fim`, e o índice só olha as vivas: quem saiu em
    // dezembro e voltou em janeiro é caso comum, não erro
    const fechou = await db.from('vaga').update({ fim: '2026-12-20' })
      .eq('serie_id', serieId).eq('pessoa_id', pessoaId).is('fim', null)
    expect(fechou.error).toBeNull()

    const { error } = await db.from('vaga').insert({
      conta_id: contaId, serie_id: serieId, pessoa_id: pessoaId,
      inicio: '2027-01-05',
    })
    expect(error).toBeNull()
  })

  it('o mesmo CPF não entra em duas fichas da mesma conta', async () => {
    await db.from('pessoa').update({ cpf: '39053344705' }).eq('id', pessoaId)
    const { error } = await db.from('pessoa').insert({
      conta_id: contaId, nome: 'Outra Marina', cpf: '39053344705',
    })
    expect(error?.code).toBe('23505')
  })

  it('duas fichas sem CPF continuam entrando', async () => {
    const base = { conta_id: contaId, nome: 'Sem documento' }
    expect((await db.from('pessoa').insert(base)).error).toBeNull()
    expect((await db.from('pessoa').insert(base)).error).toBeNull()
  })

  it('o plano vendido não some do catálogo por engano', async () => {
    await db.from('contrato').insert({
      conta_id: contaId, pessoa_id: pessoaId, plano_id: planoId,
      inicio: '2026-09-01', preco_aplicado_cent: 73500,
    })
    const { error } = await db.from('plano').delete().eq('id', planoId)
    expect(error?.code).toBe('23503')
  })

  it('contrato que termina antes de começar é recusado', async () => {
    const { error } = await db.from('contrato').insert({
      conta_id: contaId, pessoa_id: pessoaId, plano_id: planoId,
      inicio: '2026-09-01', fim: '2026-08-01', preco_aplicado_cent: 1000,
    })
    expect(error).not.toBeNull()
  })

  it('encerrar o contrato não apaga a vaga que nasceu dele', async () => {
    const { data: ct } = await db.from('contrato').insert({
      conta_id: contaId, pessoa_id: pessoaId, plano_id: planoId,
      inicio: '2026-09-01', preco_aplicado_cent: 73500,
    }).select().single()

    const { data: outraSerie } = await db.from('serie').insert({
      conta_id: contaId, servico_id: servicoId, dia_semana: 3,
      hora_inicio: '09:00', duracao_min: 60, capacidade: 6,
      vigencia_inicio: '2026-01-01',
    }).select().single()

    const { data: v } = await db.from('vaga').insert({
      conta_id: contaId, serie_id: outraSerie!.id, pessoa_id: pessoaId,
      inicio: '2026-09-01', contrato_id: ct!.id,
    }).select().single()

    await db.from('contrato').delete().eq('id', ct!.id)

    // a vaga fica, sem dono: o histórico de quem esteve na sala não pode
    // desaparecer porque o papel comercial foi apagado
    const { data: depois } = await db.from('vaga')
      .select('contrato_id').eq('id', v!.id).maybeSingle()
    expect(depois).not.toBeNull()
    expect(depois!.contrato_id).toBeNull()
  })

  it('a pausa sai junto com o contrato dela', async () => {
    const { data: ct } = await db.from('contrato').insert({
      conta_id: contaId, pessoa_id: pessoaId, plano_id: planoId,
      inicio: '2026-10-01', preco_aplicado_cent: 73500,
    }).select().single()

    await db.from('pausa').insert({
      conta_id: contaId, contrato_id: ct!.id, inicio: '2026-11-01',
    })
    await db.from('contrato').delete().eq('id', ct!.id)

    const { count } = await db.from('pausa')
      .select('*', { count: 'exact', head: true }).eq('contrato_id', ct!.id)
    expect(count).toBe(0)
  })
})
