import { describe, expect, it } from 'vitest'
import { cabeNaJanela, diaDaSemana, lerJanela } from '@/core/agenda/experimental'

/**
 * A grade que está gravada em produção para o Pilates aparelho do MGM.
 *
 * O teste existe porque a grade veio de um recado no WhatsApp, em prosa, e a
 * tradução dela para faixas é onde se erra — "segunda 12H-14H INDISPONÍVEL"
 * vira duas faixas, e quem lê rápido escreve uma. Se o Daniel mudar a grade
 * pela tela, este teste passa a descrever o passado: ele confere a tradução,
 * não o banco.
 */
const GRADE = lerJanela({
  dias: [
    [],
    [{ de: '07:00', ate: '12:00' }, { de: '14:00', ate: '21:00' }],
    [{ de: '07:00', ate: '10:00' }, { de: '11:00', ate: '12:00' }, { de: '13:00', ate: '21:00' }],
    [{ de: '15:00', ate: '21:00' }],
    [{ de: '07:00', ate: '12:00' }, { de: '14:00', ate: '21:00' }],
    [{ de: '07:00', ate: '12:00' }, { de: '14:00', ate: '21:00' }],
    [],
  ],
})

/** As horas cheias que sobram num dia, das 7h às 20h. */
function horasDe(data: string) {
  const dia = diaDaSemana(data)
  const horas: string[] = []
  for (let h = 7; h <= 20; h++) {
    const hora = `${String(h).padStart(2, '0')}:00`
    if (cabeNaJanela(GRADE, dia, hora)) horas.push(hora)
  }
  return horas
}

describe('a grade da experimental do MGM', () => {
  it('segunda: 12h e 13h ficam de fora', () => {
    const horas = horasDe('2026-09-14')
    expect(horas).not.toContain('12:00')
    expect(horas).not.toContain('13:00')
    expect(horas).toContain('11:00')
    expect(horas).toContain('14:00')
  })

  it('terça: 10h e 12h ficam de fora, 13h em diante vale', () => {
    const horas = horasDe('2026-09-15')
    expect(horas).not.toContain('10:00')
    expect(horas).not.toContain('12:00')
    expect(horas).toContain('11:00')
    expect(horas).toContain('13:00')
  })

  it('quarta: só das 15h em diante', () => {
    expect(horasDe('2026-09-16')).toEqual([
      '15:00', '16:00', '17:00', '18:00', '19:00', '20:00',
    ])
  })

  it('quinta e sexta: 12h e 13h de fora, 14h em diante vale', () => {
    for (const dia of ['2026-09-17', '2026-09-18']) {
      const horas = horasDe(dia)
      expect(horas, dia).not.toContain('12:00')
      expect(horas, dia).not.toContain('13:00')
      expect(horas, dia).toContain('14:00')
    }
  })

  it('fim de semana não tem aula experimental', () => {
    expect(horasDe('2026-09-13')).toEqual([])
    expect(horasDe('2026-09-19')).toEqual([])
  })
})
