import { describe, it, expect, beforeAll } from 'vitest'
import { admin } from './setup/supabase'
import {
  carregarPadroes, carregarFuncionamento, listarDatasFechadas,
  listarLocais, listarServicos,
} from '@/server/config/consultas'

describe('leitura da configuração', () => {
  const db = admin()
  let contaId: string
  let servicoId: string

  beforeAll(async () => {
    const m = Date.now()
    const { data: c } = await db.from('conta')
      .insert({ nome: 'Estúdio', slug: `cfg-${m}` }).select().single()
    contaId = c!.id

    const { data: s } = await db.from('servico').insert([
      { conta_id: contaId, nome: 'Pilates solo', duracao_min: 50, capacidade_padrao: 4, ativo: true },
      { conta_id: contaId, nome: 'Fáscia', duracao_min: 60, capacidade_padrao: 3, ativo: false },
    ]).select('id, nome')
    servicoId = s!.find((x) => x.nome === 'Pilates solo')!.id

    await db.from('local').insert([
      { conta_id: contaId, nome: 'Sala 1', capacidade: 4, ativo: true },
      { conta_id: contaId, nome: 'Sala 2', capacidade: null, ativo: true },
    ])

    await db.from('serie').insert({
      conta_id: contaId, servico_id: servicoId, dia_semana: 1, hora_inicio: '07:00',
      duracao_min: 50, capacidade: 4, vigencia_inicio: '2026-01-01', ativo: true,
    })
  })

  it('a conta nasce com os padrões do produto', async () => {
    const p = await carregarPadroes(db, contaId)
    expect(p.capacidadePadrao).toBe(4)
    expect(p.duracaoPadraoMin).toBe(50)
    expect(p.prazoReposicaoDias).toBe(60)
    expect(p.encaixeAcima).toBe(true)
    expect(p.creditoFaltaAvisada).toBe(true)
  })

  it('os horários sugeridos vêm em HH:MM e ordenados', async () => {
    const p = await carregarPadroes(db, contaId)
    expect(p.horariosSugeridos.length).toBeGreaterThan(0)
    expect(p.horariosSugeridos[0]).toMatch(/^\d{2}:\d{2}$/)
    expect(p.horariosSugeridos).toEqual([...p.horariosSugeridos].sort())
  })

  it('serviço inativo continua na lista, marcado', async () => {
    const lista = await listarServicos(db, contaId)
    const fascia = lista.find((s) => s.nome === 'Fáscia')!
    expect(fascia.ativo).toBe(false)
  })

  it('conta quantos horários fixos usam cada serviço', async () => {
    const lista = await listarServicos(db, contaId)
    expect(lista.find((s) => s.nome === 'Pilates solo')!.emUso).toBe(1)
    expect(lista.find((s) => s.nome === 'Fáscia')!.emUso).toBe(0)
  })

  it('local sem capacidade é normal — nem todo negócio conta lugar', async () => {
    const lista = await listarLocais(db, contaId)
    expect(lista.find((l) => l.nome === 'Sala 2')!.capacidade).toBeNull()
    expect(lista.find((l) => l.nome === 'Sala 1')!.capacidade).toBe(4)
  })

  it('funcionamento devolve os sete dias, mesmo sem nada cadastrado', async () => {
    const dias = await carregarFuncionamento(db, contaId)
    expect(dias).toHaveLength(7)
    expect(dias.every((d) => d.abre === null)).toBe(true)
  })

  it('dia cadastrado vem com hora em HH:MM', async () => {
    await db.from('funcionamento')
      .insert({ conta_id: contaId, dia_semana: 1, abre: '06:30', fecha: '20:00' })
    const dias = await carregarFuncionamento(db, contaId)
    const segunda = dias.find((d) => d.diaSemana === 1)!
    expect(segunda.abre).toBe('06:30')
    expect(segunda.fecha).toBe('20:00')
  })

  it('datas fechadas só as de hoje em diante', async () => {
    await db.from('excecao_calendario').insert([
      { conta_id: contaId, data: '2020-12-25', tipo: 'feriado', descricao: 'Natal velho',
        acao: 'so_marcar' },
      { conta_id: contaId, data: '2030-12-25', tipo: 'feriado', descricao: 'Natal',
        acao: 'cancelar_avisar' },
    ])
    const datas = await listarDatasFechadas(db, contaId, '2026-01-01')
    expect(datas.map((d) => d.data)).toEqual(['2030-12-25'])
    expect(datas[0].acao).toBe('cancelar_avisar')
  })

  it('a configuração de outra conta não vaza', async () => {
    const { data: outra } = await db.from('conta')
      .insert({ nome: 'Salão', slug: `cfg-outra-${Date.now()}` }).select().single()
    await db.from('servico')
      .insert({ conta_id: outra!.id, nome: 'Corte', duracao_min: 30, capacidade_padrao: 1, ativo: true })

    const lista = await listarServicos(db, contaId)
    expect(lista.every((s) => s.nome !== 'Corte')).toBe(true)
  })
})
