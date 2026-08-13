import { describe, it, expect } from 'vitest'
import { destinoDoPapel } from '@/core/acesso/destino'

describe('destinoDoPapel', () => {
  it('profissional cai em Hoje — a agenda dele é o trabalho dele', () => {
    expect(destinoDoPapel('profissional')).toBe('/hoje')
  })

  it('dono e recepção caem na Grade da semana', () => {
    expect(destinoDoPapel('dono')).toBe('/semana')
    expect(destinoDoPapel('recepcao')).toBe('/semana')
  })

  it('suporte cai na lista de contas', () => {
    expect(destinoDoPapel('suporte')).toBe('/contas')
  })
})
