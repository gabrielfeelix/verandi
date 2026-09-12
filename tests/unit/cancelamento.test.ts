import { describe, expect, it } from 'vitest'
import { avaliarAviso, avisoDeForaDoPrazo } from '@/core/agenda/cancelamento'

/** A aula de referência: quarta, 14/set/2026, 15h em São Paulo (18h UTC). */
const AULA = new Date('2026-09-16T18:00:00Z')

/** `horas` antes da aula. */
function antes(horas: number) {
  return new Date(AULA.getTime() - horas * 3_600_000)
}

describe('avaliarAviso', () => {
  it('avisou com folga: repõe', () => {
    const v = avaliarAviso(antes(24), AULA, 2)
    expect(v.temCredito).toBe(true)
    expect(v.horasDeAntecedencia).toBe(24)
  })

  it('avisou com 15 minutos: não repõe', () => {
    expect(avaliarAviso(antes(0.25), AULA, 2).temCredito).toBe(false)
  })

  it('exatamente 2h ainda vale — a borda é de quem avisou', () => {
    expect(avaliarAviso(antes(2), AULA, 2).temCredito).toBe(true)
  })

  it('um minuto a menos que o prazo não vale', () => {
    expect(avaliarAviso(antes(2 - 1 / 60), AULA, 2).temCredito).toBe(false)
  })

  it('exigência zero devolve crédito sempre — é o comportamento de hoje', () => {
    expect(avaliarAviso(antes(0.1), AULA, 0).temCredito).toBe(true)
  })

  it('avisar depois da aula não é aviso, nem com exigência zero', () => {
    expect(avaliarAviso(new Date(AULA.getTime() + 60_000), AULA, 0).temCredito).toBe(false)
    expect(avaliarAviso(AULA, AULA, 0).temCredito).toBe(false)
  })

  it('o veredito conta quanto faltava, para a frase e para o histórico', () => {
    const v = avaliarAviso(antes(5), AULA, 12)
    expect(v.horasDeAntecedencia).toBe(5)
    expect(v.horasExigidas).toBe(12)
    expect(v.temCredito).toBe(false)
  })
})

describe('avisoDeForaDoPrazo', () => {
  it('dentro do prazo não avisa nada', () => {
    expect(avisoDeForaDoPrazo(avaliarAviso(antes(24), AULA, 2), 'de quarta')).toBeNull()
  })

  it('fora do prazo diz o que a pessoa perde, e pergunta', () => {
    const frase = avisoDeForaDoPrazo(avaliarAviso(antes(1), AULA, 2), 'de quarta (16/09)')
    expect(frase).toContain('de quarta (16/09)')
    expect(frase).toContain('2h')
    expect(frase).toContain('não poderá ser reposta')
    expect(frase).toContain('Deseja prosseguir?')
  })
})
