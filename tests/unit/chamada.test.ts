import { describe, it, expect } from 'vitest'
import { estadoDaChamada } from '@/core/agenda/chamada'

describe('estadoDaChamada', () => {
  it('sessão sem ninguém não é chamada pendente', () => {
    expect(estadoDaChamada([])).toBe('sem_ninguem')
  })

  it('qualquer esperada deixa a chamada pendente', () => {
    expect(estadoDaChamada(['presente', 'presente', 'esperada'])).toBe('pendente')
  })

  it('confirmada pelo bot ainda é pendente — ninguém registrou se apareceu', () => {
    expect(estadoDaChamada(['confirmada'])).toBe('pendente')
  })

  it('tudo decidido é chamada feita', () => {
    expect(estadoDaChamada(['presente', 'falta', 'licenca'])).toBe('feita')
  })

  it('falta avisada conta como decidido', () => {
    expect(estadoDaChamada(['presente', 'falta_avisada'])).toBe('feita')
  })

  it('participação cancelada não deixa a chamada pendente', () => {
    expect(estadoDaChamada(['presente', 'cancelada'])).toBe('feita')
  })
})
