import { describe, it, expect } from 'vitest'
import { diaDaSemanaDe, somarDias } from '@/core/agenda/datas'

describe('diaDaSemanaDe', () => {
  it('domingo é 0 e sábado é 6', () => {
    expect(diaDaSemanaDe('2026-08-09')).toBe(0)
    expect(diaDaSemanaDe('2026-08-15')).toBe(6)
  })

  it('não muda de dia por causa de fuso', () => {
    // 1 de março de 2026 é domingo. Se alguém trocar por `new Date(iso)`, no
    // Brasil isso vira sábado e este teste é quem percebe.
    expect(diaDaSemanaDe('2026-03-01')).toBe(0)
  })
})

describe('somarDias', () => {
  it('anda para frente', () => {
    expect(somarDias('2026-08-12', 1)).toBe('2026-08-13')
  })

  it('atravessa a virada do mês', () => {
    expect(somarDias('2026-08-31', 1)).toBe('2026-09-01')
  })

  it('atravessa a virada do ano', () => {
    expect(somarDias('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('anda para trás', () => {
    expect(somarDias('2026-03-01', -1)).toBe('2026-02-28')
  })
})
