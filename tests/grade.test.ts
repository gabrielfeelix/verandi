import { describe, it, expect, beforeAll } from 'vitest'
import { admin } from './setup/supabase'
import { listarSeries } from '@/server/grade/consultas'
import { linhasDaSerie } from '@/core/agenda/serie'
import { hojeEm } from '@/server/agenda/fuso'

/**
 * A leitura da grade fixa contra o banco de verdade. As ações dependem de
 * `cookies()` e não rodam fora do Next — o caminho pela tela está em
 * `e2e/grade.spec.ts`.
 */
/**
 * As datas deste bloco são calculadas em UTC, então o fuso da conta é UTC — do
 * contrário o teste passa de dia às 21h e falha sozinho de madrugada. O efeito
 * do fuso de verdade tem bloco próprio no fim do arquivo.
 */
const FUSO = 'UTC'

describe('listarSeries', () => {
  const db = admin()
  let contaId: string
  let servicoId: string
  let profissionalId: string
  let localId: string
  let serieCheia: string
  let serieEncerrada: string

  const hoje = new Date().toISOString().slice(0, 10)
  const ontem = new Date(Date.now() - 864e5).toISOString().slice(0, 10)
  const anteontem = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10)

  beforeAll(async () => {
    const m = Date.now()
    const { data: c } = await db.from('conta')
      .insert({ nome: 'Estúdio', slug: `grade-${m}` }).select().single()
    contaId = c!.id

    const { data: s } = await db.from('servico')
      .insert({ conta_id: contaId, nome: 'Pilates solo', capacidade_padrao: 4 })
      .select().single()
    servicoId = s!.id

    const { data: p } = await db.from('profissional')
      .insert({ conta_id: contaId, nome: 'Marina' }).select().single()
    profissionalId = p!.id

    const { data: l } = await db.from('local')
      .insert({ conta_id: contaId, nome: 'Sala 1' }).select().single()
    localId = l!.id

    // três séries criadas como a tela cria: um lote só, uma linha por dia
    const { data: series, error } = await db.from('serie').insert(
      linhasDaSerie({
        servicoId, profissionalId, localId,
        diasSemana: [1, 3, 5], horaInicio: '07:00',
        duracaoMin: 60, capacidade: 4, vigenciaInicio: anteontem,
      }, contaId),
    ).select('id, dia_semana')
    expect(error).toBeNull()
    serieCheia = series!.find((s) => s.dia_semana === 1)!.id

    // uma série encerrada, que tem que aparecer separada e não sumir
    const { data: enc } = await db.from('serie').insert(
      linhasDaSerie({
        servicoId, diasSemana: [2], horaInicio: '19:00',
        duracaoMin: 45, capacidade: 2,
        vigenciaInicio: anteontem, vigenciaFim: ontem,
      }, contaId)[0],
    ).select('id').single()
    serieEncerrada = enc!.id

    const { data: pessoas } = await db.from('pessoa').insert(
      ['Helena', 'Otávio', 'Beatriz'].map((nome) => ({ conta_id: contaId, nome })),
    ).select('id')

    // duas vagas vivas, uma já encerrada: só as vivas contam como ocupadas
    const { error: erroVaga } = await db.from('vaga').insert([
      { conta_id: contaId, serie_id: serieCheia, pessoa_id: pessoas![0].id,
        inicio: anteontem, fim: null },
      { conta_id: contaId, serie_id: serieCheia, pessoa_id: pessoas![1].id,
        inicio: anteontem, fim: null },
      { conta_id: contaId, serie_id: serieCheia, pessoa_id: pessoas![2].id,
        inicio: anteontem, fim: ontem },
    ])
    expect(erroVaga).toBeNull()
  })

  it('devolve as séries da conta, com serviço, profissional e local pelo nome', async () => {
    const linhas = await listarSeries(db, contaId, FUSO)
    const segunda = linhas.find((l) => l.id === serieCheia)!
    expect(segunda.servico).toBe('Pilates solo')
    expect(segunda.profissional).toBe('Marina')
    expect(segunda.local).toBe('Sala 1')
    expect(segunda.capacidade).toBe(4)
  })

  it('ocupadas conta só a vaga viva hoje — quem saiu não ocupa mais', async () => {
    const linhas = await listarSeries(db, contaId, FUSO)
    expect(linhas.find((l) => l.id === serieCheia)!.ocupadas).toBe(2)
  })

  it('série sem ninguém tem ocupadas zero, e não some da lista', async () => {
    const linhas = await listarSeries(db, contaId, FUSO)
    const quarta = linhas.find((l) => l.diaSemana === 3)!
    expect(quarta.ocupadas).toBe(0)
  })

  it('série encerrada vem marcada, com a data de fim', async () => {
    const linhas = await listarSeries(db, contaId, FUSO)
    const enc = linhas.find((l) => l.id === serieEncerrada)!
    expect(enc.encerrada).toBe(true)
    expect(enc.vigenciaFim).toBe(ontem)
  })

  it('série que vale hoje não está encerrada', async () => {
    const linhas = await listarSeries(db, contaId, FUSO)
    expect(linhas.find((l) => l.id === serieCheia)!.encerrada).toBe(false)
  })

  it('série com fim marcado para hoje ainda vale hoje', async () => {
    const { data } = await db.from('serie').insert(
      linhasDaSerie({
        servicoId, diasSemana: [6], horaInicio: '08:00', duracaoMin: 60,
        capacidade: 3, vigenciaInicio: anteontem, vigenciaFim: hoje,
      }, contaId)[0],
    ).select('id').single()

    const linhas = await listarSeries(db, contaId, FUSO)
    expect(linhas.find((l) => l.id === data!.id)!.encerrada).toBe(false)
  })

  it('vem ordenado por dia da semana e hora — é como a tela agrupa', async () => {
    const linhas = (await listarSeries(db, contaId, FUSO)).filter((l) => !l.encerrada)
    const chave = linhas.map((l) => `${l.diaSemana}-${l.horaInicio}`)
    expect(chave).toEqual([...chave].sort())
  })

  it('a série de outra conta não aparece', async () => {
    const { data: outra } = await db.from('conta')
      .insert({ nome: 'Salão', slug: `grade-outra-${Date.now()}` }).select().single()
    const { data: servOutra } = await db.from('servico')
      .insert({ conta_id: outra!.id, nome: 'Corte' }).select().single()
    await db.from('serie').insert(
      linhasDaSerie({
        servicoId: servOutra!.id, diasSemana: [1], horaInicio: '07:00',
        duracaoMin: 60, capacidade: 1, vigenciaInicio: anteontem,
      }, outra!.id)[0],
    )

    const linhas = await listarSeries(db, contaId, FUSO)
    expect(linhas.every((l) => l.servico !== 'Corte')).toBe(true)
  })

  it('série inativa não aparece', async () => {
    const { data } = await db.from('serie').insert(
      linhasDaSerie({
        servicoId, diasSemana: [0], horaInicio: '10:00', duracaoMin: 60,
        capacidade: 2, vigenciaInicio: anteontem,
      }, contaId)[0],
    ).select('id').single()
    await db.from('serie').update({ ativo: false }).eq('id', data!.id)

    const linhas = await listarSeries(db, contaId, FUSO)
    expect(linhas.some((l) => l.id === data!.id)).toBe(false)
  })

  it('listar a grade não materializa sessão nenhuma — grade é configuração', async () => {
    const antes = await db.from('sessao')
      .select('*', { count: 'exact', head: true }).eq('conta_id', contaId)
    await listarSeries(db, contaId, FUSO)
    const depois = await db.from('sessao')
      .select('*', { count: 'exact', head: true }).eq('conta_id', contaId)
    expect(depois.count).toBe(antes.count)
  })
})

/**
 * "Hoje" é pergunta da conta, não da máquina.
 *
 * `new Date().toISOString().slice(0, 10)` já é o dia seguinte depois das 21h em
 * Brasília: a ocupação da grade mudaria de número à noite, e a série encerrada
 * hoje apareceria como encerrada antes da hora. Kiritimati (UTC+14) e Niue
 * (UTC−11) estão sempre em datas diferentes entre si, então um dos dois discorda
 * de UTC a qualquer momento do dia — é o que torna este teste determinístico.
 */
describe('hojeEm respeita o fuso da conta', () => {
  const db = admin()

  it('a data local de dois fusos extremos nunca é a mesma', () => {
    expect(hojeEm('Pacific/Kiritimati')).not.toBe(hojeEm('Pacific/Niue'))
  })

  it('série que termina hoje no fuso da conta ainda não está encerrada', async () => {
    const m = Date.now()
    const { data: c } = await db.from('conta')
      .insert({ nome: 'Estúdio remoto', slug: `fuso-${m}`, fuso: 'Pacific/Kiritimati' })
      .select().single()
    const { data: s } = await db.from('servico')
      .insert({ conta_id: c!.id, nome: 'Aula' }).select().single()

    const hojeLa = hojeEm('Pacific/Kiritimati')
    const { data: serie } = await db.from('serie').insert(
      linhasDaSerie({
        servicoId: s!.id, diasSemana: [1], horaInicio: '07:00', duracaoMin: 60,
        capacidade: 2, vigenciaInicio: '2020-01-01', vigenciaFim: hojeLa,
      }, c!.id)[0],
    ).select('id').single()

    const linhas = await listarSeries(db, c!.id, 'Pacific/Kiritimati')
    expect(linhas.find((l) => l.id === serie!.id)!.encerrada).toBe(false)
  })
})
