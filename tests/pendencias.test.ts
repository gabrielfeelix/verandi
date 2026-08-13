import { describe, it, expect, beforeAll } from 'vitest'
import { admin } from './setup/supabase'
import { listarPendencias, type TipoPendencia } from '@/server/pendencias/consultas'

const DIA = 864e5
const atras = (dias: number) => new Date(Date.now() - dias * DIA).toISOString()
const adiante = (dias: number) => new Date(Date.now() + dias * DIA).toISOString()

describe('pendências', () => {
  const db = admin()
  let contaId: string
  let servicoId: string
  let pessoas: { id: string; nome: string }[]
  let faltaRecente: string
  let faltaVelha: string

  async function grupos() {
    return listarPendencias(db, contaId, 'UTC')
  }

  const doGrupo = async (tipo: TipoPendencia) =>
    (await grupos()).find((g) => g.tipo === tipo)?.itens ?? []

  beforeAll(async () => {
    const m = Date.now()
    const { data: c } = await db.from('conta')
      .insert({ nome: 'Estúdio', slug: `pend-${m}`, fuso: 'UTC' }).select().single()
    contaId = c!.id

    const { data: s } = await db.from('servico')
      .insert({ conta_id: contaId, nome: 'Pilates solo' }).select().single()
    servicoId = s!.id

    const { data: ps } = await db.from('pessoa').insert(
      ['Helena Moraes', 'Otávio Prado', 'Beatriz Nogueira']
        .map((nome) => ({ conta_id: contaId, nome, telefone: '11999990000' })),
    ).select('id, nome')
    pessoas = ps!

    // chamada não feita: sessão de ontem com gente ainda esperada
    const { data: ontem } = await db.from('sessao').insert({
      conta_id: contaId, servico_id: servicoId, inicio: atras(1),
      duracao_min: 60, capacidade: 4, status: 'prevista', motivo_cancelamento: null,
    }).select().single()
    await db.from('participacao').insert({
      conta_id: contaId, sessao_id: ontem!.id, pessoa_id: pessoas[0].id,
      origem: 'recorrente', status: 'esperada',
    })

    // chamada feita: mesma forma, todo mundo decidido
    const { data: feita } = await db.from('sessao').insert({
      conta_id: contaId, servico_id: servicoId, inicio: atras(2),
      duracao_min: 60, capacidade: 4, status: 'prevista', motivo_cancelamento: null,
    }).select().single()
    await db.from('participacao').insert({
      conta_id: contaId, sessao_id: feita!.id, pessoa_id: pessoas[1].id,
      origem: 'recorrente', status: 'presente',
    })

    // falta de 10 dias atrás, e outra de 200 — o prazo separa as duas
    const { data: sRecente } = await db.from('sessao').insert({
      conta_id: contaId, servico_id: servicoId, inicio: atras(10),
      duracao_min: 60, capacidade: 4, status: 'realizada', motivo_cancelamento: null,
    }).select().single()
    const { data: pRecente } = await db.from('participacao').insert({
      conta_id: contaId, sessao_id: sRecente!.id, pessoa_id: pessoas[0].id,
      origem: 'recorrente', status: 'falta',
    }).select().single()
    faltaRecente = pRecente!.id

    const { data: sVelha } = await db.from('sessao').insert({
      conta_id: contaId, servico_id: servicoId, inicio: atras(200),
      duracao_min: 60, capacidade: 4, status: 'realizada', motivo_cancelamento: null,
    }).select().single()
    const { data: pVelha } = await db.from('participacao').insert({
      conta_id: contaId, sessao_id: sVelha!.id, pessoa_id: pessoas[1].id,
      origem: 'recorrente', status: 'falta',
    }).select().single()
    faltaVelha = pVelha!.id

    // reserva esperando, numa sessão do futuro
    const { data: futura } = await db.from('sessao').insert({
      conta_id: contaId, servico_id: servicoId, inicio: adiante(3),
      duracao_min: 60, capacidade: 1, status: 'prevista', motivo_cancelamento: null,
    }).select().single()
    await db.from('participacao').insert({
      conta_id: contaId, sessao_id: futura!.id, pessoa_id: pessoas[2].id,
      origem: 'reserva', status: 'esperada',
    })
  })

  it('sessão que passou com gente esperada é chamada não feita', async () => {
    expect((await doGrupo('chamada_nao_feita')).length).toBe(1)
  })

  it('sessão com todo mundo decidido não aparece', async () => {
    const itens = await doGrupo('chamada_nao_feita')
    expect(itens.every((i) => !i.detalhe.includes('Otávio'))).toBe(true)
  })

  it('falta dentro do prazo vira reposição em aberto, com a idade', async () => {
    const itens = await doGrupo('reposicao_aberta')
    const helena = itens.find((i) => i.titulo === 'Helena Moraes')!
    expect(helena.diasEmAberto).toBe(10)
  })

  it('falta mais velha que o prazo some — é o que faz a lista esvaziar', async () => {
    const itens = await doGrupo('reposicao_aberta')
    expect(itens.some((i) => i.referenciaId === faltaVelha)).toBe(false)
  })

  it('aumentar o prazo traz a falta velha de volta', async () => {
    await db.from('conta').update({ prazo_reposicao_dias: 365 }).eq('id', contaId)
    const itens = await doGrupo('reposicao_aberta')
    expect(itens.some((i) => i.referenciaId === faltaVelha)).toBe(true)
    await db.from('conta').update({ prazo_reposicao_dias: 60 }).eq('id', contaId)
  })

  it('falta já reposta sai da lista', async () => {
    const { data: nova } = await db.from('sessao').insert({
      conta_id: contaId, servico_id: servicoId, inicio: adiante(1),
      duracao_min: 60, capacidade: 4, status: 'prevista', motivo_cancelamento: null,
    }).select().single()
    await db.from('participacao').insert({
      conta_id: contaId, sessao_id: nova!.id, pessoa_id: pessoas[0].id,
      origem: 'reposicao', status: 'esperada', reposicao_de_id: faltaRecente,
    })

    const itens = await doGrupo('reposicao_aberta')
    expect(itens.some((i) => i.referenciaId === faltaRecente)).toBe(false)
  })

  it('com crédito por falta avisada desligado, só falta simples conta', async () => {
    const { data: s } = await db.from('sessao').insert({
      conta_id: contaId, servico_id: servicoId, inicio: atras(5),
      duracao_min: 60, capacidade: 4, status: 'realizada', motivo_cancelamento: null,
    }).select().single()
    const { data: p } = await db.from('participacao').insert({
      conta_id: contaId, sessao_id: s!.id, pessoa_id: pessoas[2].id,
      origem: 'recorrente', status: 'falta_avisada',
    }).select().single()

    expect((await doGrupo('reposicao_aberta')).some((i) => i.referenciaId === p!.id)).toBe(true)

    await db.from('conta').update({ credito_falta_avisada: false }).eq('id', contaId)
    expect((await doGrupo('reposicao_aberta')).some((i) => i.referenciaId === p!.id)).toBe(false)
    await db.from('conta').update({ credito_falta_avisada: true }).eq('id', contaId)
  })

  it('reserva em sessão futura aparece; em sessão passada, não', async () => {
    expect((await doGrupo('reserva_esperando')).length).toBe(1)
  })

  it('cadastro incompleto só de quem ocupa horário hoje', async () => {
    const { data: semTel } = await db.from('pessoa').insert({
      conta_id: contaId, nome: 'Larissa Cruz', telefone: null,
    }).select().single()

    // sem vaga viva, não cobra: quem nunca voltou não é pendência
    expect((await doGrupo('cadastro_incompleto')).length).toBe(0)

    const { data: serie } = await db.from('serie').insert({
      conta_id: contaId, servico_id: servicoId, dia_semana: 1, hora_inicio: '07:00',
      duracao_min: 60, capacidade: 4, vigencia_inicio: '2020-01-01', ativo: true,
    }).select().single()
    await db.from('vaga').insert({
      conta_id: contaId, serie_id: serie!.id, pessoa_id: semTel!.id,
      inicio: '2020-01-01', fim: null,
    })

    const itens = await doGrupo('cadastro_incompleto')
    expect(itens.map((i) => i.titulo)).toContain('Larissa Cruz')
  })

  it('dispensar tira da lista e não volta', async () => {
    const antes = await doGrupo('chamada_nao_feita')
    expect(antes.length).toBe(1)

    await db.from('pendencia_dispensada').insert({
      conta_id: contaId, tipo: 'chamada_nao_feita', referencia_id: antes[0].referenciaId,
      motivo: 'turma não aconteceu',
    })

    expect((await doGrupo('chamada_nao_feita')).length).toBe(0)
  })

  it('grupo vazio não aparece — a lista é esvaziável', async () => {
    const { data: outra } = await db.from('conta')
      .insert({ nome: 'Nova', slug: `pend-vazia-${Date.now()}` }).select().single()
    expect(await listarPendencias(db, outra!.id, 'UTC')).toEqual([])
  })
})
