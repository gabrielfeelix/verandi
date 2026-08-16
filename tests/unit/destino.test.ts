import { describe, it, expect } from 'vitest'
import { destinoDoPapel } from '@/core/acesso/destino'

describe('destinoDoPapel', () => {
  it('profissional cai em Hoje — a agenda dele é o trabalho dele', () => {
    expect(destinoDoPapel('profissional')).toBe('/hoje')
  })

  it('dono e recepção caem na Agenda da semana', () => {
    expect(destinoDoPapel('dono')).toBe('/semana')
    expect(destinoDoPapel('recepcao')).toBe('/semana')
  })

  it('suporte cai na lista de contas dos clientes, não na troca de conta', () => {
    // `/contas` devolve quem tem uma conta só para `destinoDoPapel`; o suporte
    // tem uma conta só (a interna), então apontar para lá fecha um laço de
    // redirecionamento e a tela fica em branco
    expect(destinoDoPapel('suporte')).toBe('/contas-4yu')
  })
})
