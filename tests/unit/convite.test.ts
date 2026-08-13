import { describe, it, expect } from 'vitest'
import { estadoDoConvite, type ConviteBase } from '@/core/acesso/convite'

const AGORA = new Date('2026-08-13T12:00:00Z')

const convite = (over: Partial<ConviteBase> = {}): ConviteBase => ({
  expiraEm: '2026-08-20T12:00:00Z',
  aceitoEm: null,
  revogadoEm: null,
  ...over,
})

describe('estadoDoConvite', () => {
  it('convite dentro do prazo, não aceito e não revogado é válido', () => {
    expect(estadoDoConvite(convite(), AGORA)).toBe('valido')
  })

  it('token que não existe é inexistente', () => {
    expect(estadoDoConvite(null, AGORA)).toBe('inexistente')
  })

  it('passado o prazo é expirado', () => {
    expect(estadoDoConvite(convite({ expiraEm: '2026-08-12T12:00:00Z' }), AGORA))
      .toBe('expirado')
  })

  it('expirar no instante exato já é expirado', () => {
    expect(estadoDoConvite(convite({ expiraEm: AGORA.toISOString() }), AGORA))
      .toBe('expirado')
  })

  it('já aceito é já aceito', () => {
    expect(estadoDoConvite(convite({ aceitoEm: '2026-08-11T09:00:00Z' }), AGORA))
      .toBe('ja_aceito')
  })

  it('revogado é revogado', () => {
    expect(estadoDoConvite(convite({ revogadoEm: '2026-08-12T09:00:00Z' }), AGORA))
      .toBe('revogado')
  })

  it('já aceito ganha de expirado — é a informação que resolve o problema de quem abriu', () => {
    const c = convite({ aceitoEm: '2026-08-11T09:00:00Z', expiraEm: '2026-08-12T12:00:00Z' })
    expect(estadoDoConvite(c, AGORA)).toBe('ja_aceito')
  })

  it('revogado ganha de expirado', () => {
    const c = convite({ revogadoEm: '2026-08-11T09:00:00Z', expiraEm: '2026-08-12T12:00:00Z' })
    expect(estadoDoConvite(c, AGORA)).toBe('revogado')
  })

  it('nenhum estado terminal é "valido" por acidente', () => {
    const terminais: ConviteBase[] = [
      convite({ aceitoEm: '2026-08-11T09:00:00Z' }),
      convite({ revogadoEm: '2026-08-11T09:00:00Z' }),
      convite({ expiraEm: '2026-01-01T00:00:00Z' }),
    ]
    for (const c of terminais) expect(estadoDoConvite(c, AGORA)).not.toBe('valido')
  })
})
