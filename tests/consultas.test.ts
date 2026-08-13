import { describe, it, expect, beforeAll } from 'vitest'
import { admin } from './setup/supabase'
import { sessoesDoIntervalo, sessaoDetalhe } from '@/server/agenda/consultas'

describe('consultas de agenda', () => {
  const db = admin()
  let contaId: string
  let profA: string, profB: string
  let pessoaFixa: string, pessoaEncaixe: string

  beforeAll(async () => {
    const m = Date.now()
    const { data: c } = await db.from('conta')
      .insert({ nome: 'Estúdio', slug: `cons-${m}`, fuso: 'America/Sao_Paulo' })
      .select().single()
    contaId = c!.id

    const { data: servico } = await db.from('servico')
      .insert({ conta_id: contaId, nome: 'Pilates solo', capacidade_padrao: 4 })
      .select().single()
    const { data: local } = await db.from('local')
      .insert({ conta_id: contaId, nome: 'Sala 1' }).select().single()
    const { data: profs } = await db.from('profissional').insert([
      { conta_id: contaId, nome: 'Marina' },
      { conta_id: contaId, nome: 'Sofia' },
    ]).select()
    profA = profs![0].id
    profB = profs![1].id

    // segunda 07h com Marina, quarta 10h com Sofia
    const { data: series } = await db.from('serie').insert([
      { conta_id: contaId, servico_id: servico!.id, profissional_id: profA,
        local_id: local!.id, dia_semana: 1, hora_inicio: '07:00',
        duracao_min: 60, capacidade: 4, vigencia_inicio: '2026-01-01' },
      { conta_id: contaId, servico_id: servico!.id, profissional_id: profB,
        local_id: local!.id, dia_semana: 3, hora_inicio: '10:00',
        duracao_min: 60, capacidade: 2, vigencia_inicio: '2026-01-01' },
    ]).select()

    const { data: pessoas } = await db.from('pessoa').insert([
      { conta_id: contaId, nome: 'Helena', telefone: '11999990000' },
      { conta_id: contaId, nome: 'Otávio' },
    ]).select()
    pessoaFixa = pessoas![0].id
    pessoaEncaixe = pessoas![1].id

    await db.from('vaga').insert({
      conta_id: contaId, serie_id: series![0].id,
      pessoa_id: pessoaFixa, inicio: '2026-01-01',
    })
    await db.from('pessoa_tag').insert({
      pessoa_id: pessoaFixa, conta_id: contaId, tag: 'gestante',
    })
    await db.from('excecao_calendario').insert({
      conta_id: contaId, data: '2026-08-17', tipo: 'feriado', descricao: 'Teste',
    })
  })

  it('materializa o intervalo antes de listar', async () => {
    // nada foi materializado ainda: a lista tem que criar e devolver
    const r = await sessoesDoIntervalo(db, contaId, '2026-08-03', '2026-08-09')
    expect(r.map((s) => `${s.data} ${s.hora}`)).toEqual([
      '2026-08-03 07:00', '2026-08-05 10:00',
    ])
  })

  it('a ocupação vem calculada, com a vaga recorrente já semeada', async () => {
    const [segunda] = await sessoesDoIntervalo(db, contaId, '2026-08-03', '2026-08-03')
    expect(segunda.ocupacao).toMatchObject({ capacidade: 4, ocupadas: 1, livres: 3 })
    expect(segunda.chamada).toBe('pendente')
  })

  it('sessão sem ninguém não fica com chamada pendente', async () => {
    const [quarta] = await sessoesDoIntervalo(db, contaId, '2026-08-05', '2026-08-05')
    expect(quarta.ocupacao.ocupadas).toBe(0)
    expect(quarta.chamada).toBe('sem_ninguem')
  })

  it('sessão de feriado aparece cancelada, com o motivo — não some', async () => {
    const r = await sessoesDoIntervalo(db, contaId, '2026-08-17', '2026-08-17')
    expect(r).toHaveLength(1)
    expect(r[0].status).toBe('cancelada')
    expect(r[0].motivoCancelamento).toContain('feriado')
  })

  it('filtra por profissional', async () => {
    const r = await sessoesDoIntervalo(
      db, contaId, '2026-08-03', '2026-08-09', { profissionalId: profB },
    )
    expect(r).toHaveLength(1)
    expect(r[0].profissional).toBe('Sofia')
  })

  it('o detalhe traz participações, tags e telefone ausente', async () => {
    const [segunda] = await sessoesDoIntervalo(db, contaId, '2026-08-03', '2026-08-03')
    await db.from('participacao').insert({
      conta_id: contaId, sessao_id: segunda.id, pessoa_id: pessoaEncaixe,
      origem: 'encaixe',
    })

    const d = await sessaoDetalhe(db, segunda.id)
    expect(d!.participacoes).toHaveLength(2)

    // recorrente em cima, encaixe embaixo — a leitura de relance depende disso
    expect(d!.participacoes[0].origem).toBe('recorrente')
    expect(d!.participacoes[0].tags).toEqual(['gestante'])
    expect(d!.participacoes[1].origem).toBe('encaixe')
    expect(d!.participacoes[1].telefone).toBeNull()
  })

  it('devolve nulo para sessão que não existe', async () => {
    expect(await sessaoDetalhe(db, '00000000-0000-0000-0000-000000000000')).toBeNull()
  })
})
