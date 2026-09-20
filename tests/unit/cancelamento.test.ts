import { describe, expect, it } from 'vitest'
import { avaliarAviso, avisoDeForaDoPrazo, prazoPorExtenso } from '@/core/agenda/cancelamento'

/** A aula de referência: quarta, 16/set/2026, 15h em São Paulo (18h UTC). */
const AULA = new Date('2026-09-16T18:00:00Z')

/** `minutos` antes da aula. */
function antes(minutos: number) {
  return new Date(AULA.getTime() - minutos * 60_000)
}

describe('avaliarAviso', () => {
  it('avisou com folga: repõe', () => {
    const v = avaliarAviso(antes(24 * 60), AULA, 120)
    expect(v.temCredito).toBe(true)
    expect(v.minutosDeAntecedencia).toBe(1440)
  })

  it('avisou com 15 minutos: não repõe', () => {
    expect(avaliarAviso(antes(15), AULA, 120).temCredito).toBe(false)
  })

  it('exatamente no prazo ainda vale — a borda é de quem avisou', () => {
    expect(avaliarAviso(antes(120), AULA, 120).temCredito).toBe(true)
  })

  it('um minuto a menos que o prazo não vale', () => {
    expect(avaliarAviso(antes(119), AULA, 120).temCredito).toBe(false)
  })

  it('exigência zero devolve crédito sempre — é o comportamento de hoje', () => {
    expect(avaliarAviso(antes(6), AULA, 0).temCredito).toBe(true)
  })

  it('avisar depois da aula não é aviso, nem com exigência zero', () => {
    expect(avaliarAviso(new Date(AULA.getTime() + 60_000), AULA, 0).temCredito).toBe(false)
    expect(avaliarAviso(AULA, AULA, 0).temCredito).toBe(false)
  })

  it('o veredito conta quanto faltava, para a frase e para o histórico', () => {
    const v = avaliarAviso(antes(5 * 60), AULA, 12 * 60)
    expect(v.minutosDeAntecedencia).toBe(300)
    expect(v.minutosExigidos).toBe(720)
    expect(v.temCredito).toBe(false)
  })

  /*
   * O caso que motivou a 0062: meia hora não existia em inteiro de horas, e
   * virava 0 (crédito para todo mundo) ou 1 (o dobro do combinado).
   */
  it('prazo de 30 minutos distingue os dois lados da borda', () => {
    expect(avaliarAviso(antes(31), AULA, 30).temCredito).toBe(true)
    expect(avaliarAviso(antes(29), AULA, 30).temCredito).toBe(false)
  })
})

describe('prazoPorExtenso', () => {
  it('abaixo de uma hora fala em minutos', () => {
    expect(prazoPorExtenso(30)).toBe('30 minutos')
    expect(prazoPorExtenso(45)).toBe('45 minutos')
  })

  it('hora redonda fala em horas', () => {
    expect(prazoPorExtenso(60)).toBe('1h')
    expect(prazoPorExtenso(120)).toBe('2h')
  })

  it('hora quebrada se lê como horário, não como soma de minutos', () => {
    expect(prazoPorExtenso(90)).toBe('1h30')
    expect(prazoPorExtenso(125)).toBe('2h05')
  })
})

describe('avisoDeForaDoPrazo', () => {
  it('dentro do prazo não avisa nada', () => {
    expect(avisoDeForaDoPrazo(avaliarAviso(antes(24 * 60), AULA, 120), 'de quarta')).toBeNull()
  })

  it('fora do prazo diz o que a pessoa perde, e pergunta', () => {
    const frase = avisoDeForaDoPrazo(avaliarAviso(antes(60), AULA, 120), 'de quarta (16/09)')
    expect(frase).toContain('de quarta (16/09)')
    expect(frase).toContain('2h')
    expect(frase).toContain('não poderá ser reposta')
    expect(frase).toContain('Deseja prosseguir?')
  })

  it('o prazo aparece como o estúdio o diz, e não em minutos crus', () => {
    const frase = avisoDeForaDoPrazo(avaliarAviso(antes(10), AULA, 30), 'de hoje')
    expect(frase).toContain('30 minutos')
    expect(frase).not.toContain('0.5')
  })
})
