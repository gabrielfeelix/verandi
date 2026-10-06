import { describe, expect, it } from 'vitest'
import { inicioDaPessoa } from '@/core/pessoas/inicio'

describe('inicioDaPessoa', () => {
  it('importado hoje com contrato e aula antigos é cliente desde o mais antigo', () => {
    expect(inicioDaPessoa(['2026-10-06T13:00:00Z', '2026-08-01', '2026-07-15T10:00:00Z']))
      .toBe('2026-07-15')
  })

  it('sem contrato nem aula, vale o cadastro', () => {
    expect(inicioDaPessoa(['2026-10-06T13:00:00Z', null, undefined])).toBe('2026-10-06')
  })
})
