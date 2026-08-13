import { describe, it, expect, beforeAll } from 'vitest'
import { admin } from './setup/supabase'
import { materializarJanela } from '@/server/agenda/materializar'

describe('materializarJanela', () => {
  const db = admin()
  let contaId: string, serieId: string, pessoaId: string

  beforeAll(async () => {
    const marca = Date.now()
    const { data: c } = await db.from('conta')
      .insert({ nome: 'Estúdio', slug: `m-${marca}`, fuso: 'America/Sao_Paulo' })
      .select().single()
    contaId = c!.id

    const { data: s } = await db.from('servico')
      .insert({ conta_id: contaId, nome: 'Pilates solo' }).select().single()

    // segunda-feira, 07:00, capacidade 4, valendo desde março
    const { data: se } = await db.from('serie').insert({
      conta_id: contaId, servico_id: s!.id, dia_semana: 1, hora_inicio: '07:00',
      duracao_min: 60, capacidade: 4, vigencia_inicio: '2026-03-01',
    }).select().single()
    serieId = se!.id

    const { data: p } = await db.from('pessoa')
      .insert({ conta_id: contaId, nome: 'Helena' }).select().single()
    pessoaId = p!.id

    await db.from('vaga').insert({
      conta_id: contaId, serie_id: serieId, pessoa_id: pessoaId, inicio: '2026-03-01',
    })

    await db.from('excecao_calendario').insert({
      conta_id: contaId, data: '2026-08-10', tipo: 'feriado', descricao: 'Teste',
    })
  })

  it('cria uma sessão por ocorrência da janela', async () => {
    const r = await materializarJanela(db, contaId, '2026-08-01', '2026-08-31')
    expect(r.criadas).toBe(5) // 3, 10, 17, 24 e 31 de agosto são segundas
  })

  it('é idempotente — rodar de novo não duplica', async () => {
    const r = await materializarJanela(db, contaId, '2026-08-01', '2026-08-31')
    expect(r.criadas).toBe(0)

    const { count } = await db.from('sessao')
      .select('*', { count: 'exact', head: true })
      .eq('serie_id', serieId)
    expect(count).toBe(5)
  })

  it('a sessão do feriado nasce cancelada, com motivo', async () => {
    const { data } = await db.from('sessao').select('status, motivo_cancelamento')
      .eq('serie_id', serieId)
      .gte('inicio', '2026-08-10T00:00:00Z').lt('inicio', '2026-08-11T00:00:00Z')
      .single()
    expect(data?.status).toBe('cancelada')
    expect(data?.motivo_cancelamento).toContain('feriado')
  })

  it('semeia a participação de quem tem vaga recorrente', async () => {
    const { data } = await db.from('participacao')
      .select('origem, status').eq('pessoa_id', pessoaId)
    expect(data).toHaveLength(5)
    expect(data![0]).toMatchObject({ origem: 'recorrente', status: 'esperada' })
  })

  it('a hora local vira o instante certo no fuso da conta', async () => {
    const { data } = await db.from('sessao').select('inicio')
      .eq('serie_id', serieId).order('inicio').limit(1).single()
    // 07:00 em America/Sao_Paulo (UTC-3) é 10:00Z
    expect(new Date(data!.inicio).toISOString()).toBe('2026-08-03T10:00:00.000Z')
  })

  it('não semeia participação de vaga que já foi encerrada', async () => {
    const { data: p2 } = await db.from('pessoa')
      .insert({ conta_id: contaId, nome: 'Saiu em julho' }).select().single()
    await db.from('vaga').insert({
      conta_id: contaId, serie_id: serieId, pessoa_id: p2!.id,
      inicio: '2026-03-01', fim: '2026-07-31',
    })
    await materializarJanela(db, contaId, '2026-09-01', '2026-09-30')

    const { count } = await db.from('participacao')
      .select('*', { count: 'exact', head: true }).eq('pessoa_id', p2!.id)
    expect(count).toBe(0)
  })

  it('duas chamadas simultâneas não duplicam', async () => {
    const antes = await db.from('sessao')
      .select('*', { count: 'exact', head: true }).eq('conta_id', contaId)

    await Promise.all([
      materializarJanela(db, contaId, '2026-10-01', '2026-10-31'),
      materializarJanela(db, contaId, '2026-10-01', '2026-10-31'),
      materializarJanela(db, contaId, '2026-10-01', '2026-10-31'),
    ])

    const depois = await db.from('sessao')
      .select('*', { count: 'exact', head: true }).eq('conta_id', contaId)
    expect((depois.count ?? 0) - (antes.count ?? 0)).toBe(4) // outubro tem 4 segundas
  })
})
