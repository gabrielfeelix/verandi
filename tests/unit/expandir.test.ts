import { describe, it, expect } from 'vitest'
import { expandirSerie } from '@/core/agenda/expandir'
import type { Serie } from '@/core/agenda/tipos'

const segunda7h: Serie = {
  id: 's1',
  diaSemana: 1,
  horaInicio: '07:00',
  duracaoMin: 60,
  capacidade: 4,
  vigenciaInicio: '2026-01-01',
  vigenciaFim: null,
  ativo: true,
}

describe('expandirSerie', () => {
  it('gera só os dias da semana da série', () => {
    const r = expandirSerie(segunda7h, '2026-08-01', '2026-08-31', [])
    expect(r.map((o) => o.data)).toEqual([
      '2026-08-03', '2026-08-10', '2026-08-17', '2026-08-24', '2026-08-31',
    ])
  })

  it('carrega horário, duração e capacidade da série', () => {
    const [primeira] = expandirSerie(segunda7h, '2026-08-01', '2026-08-05', [])
    expect(primeira).toMatchObject({
      serieId: 's1', horaInicio: '07:00', duracaoMin: 60, capacidade: 4,
      bloqueada: false,
    })
  })

  it('não gera antes do início da vigência', () => {
    const s = { ...segunda7h, vigenciaInicio: '2026-08-11' }
    const r = expandirSerie(s, '2026-08-01', '2026-08-31', [])
    expect(r.map((o) => o.data)).toEqual(['2026-08-17', '2026-08-24', '2026-08-31'])
  })

  it('não gera depois do fim da vigência', () => {
    const s = { ...segunda7h, vigenciaFim: '2026-08-18' }
    const r = expandirSerie(s, '2026-08-01', '2026-08-31', [])
    expect(r.map((o) => o.data)).toEqual(['2026-08-03', '2026-08-10', '2026-08-17'])
  })

  it('série inativa não gera nada', () => {
    const r = expandirSerie({ ...segunda7h, ativo: false }, '2026-08-01', '2026-08-31', [])
    expect(r).toEqual([])
  })

  it('intervalo invertido gera vazio em vez de laço infinito', () => {
    const r = expandirSerie(segunda7h, '2026-08-31', '2026-08-01', [])
    expect(r).toEqual([])
  })

  it('feriado gera ocorrência BLOQUEADA, não some da grade', () => {
    const r = expandirSerie(segunda7h, '2026-08-01', '2026-08-31', [
      { data: '2026-08-10', tipo: 'feriado' },
    ])
    expect(r).toHaveLength(5)
    expect(r[1]).toMatchObject({ data: '2026-08-10', bloqueada: true, motivo: 'feriado' })
    expect(r[0].bloqueada).toBe(false)
  })

  it('exceção em dia que não é da série é ignorada', () => {
    const r = expandirSerie(segunda7h, '2026-08-01', '2026-08-31', [
      { data: '2026-08-11', tipo: 'fechado' },
    ])
    expect(r.every((o) => !o.bloqueada)).toBe(true)
  })

  it('intervalo de um dia só, batendo no dia da série, gera uma', () => {
    const r = expandirSerie(segunda7h, '2026-08-10', '2026-08-10', [])
    expect(r.map((o) => o.data)).toEqual(['2026-08-10'])
  })
})
