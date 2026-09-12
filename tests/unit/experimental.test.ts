import { describe, expect, it } from 'vitest'
import {
  cabeNaJanela,
  diaDaSemana,
  emMinutos,
  lerJanela,
  type JanelaExperimental,
} from '@/core/agenda/experimental'

/** Sete listas vazias, para preencher só o dia que o teste quer. */
function janela(preenche: (dias: Array<Array<{ de: string; ate: string }>>) => void) {
  const dias: Array<Array<{ de: string; ate: string }>> = [[], [], [], [], [], [], []]
  preenche(dias)
  return { dias } as JanelaExperimental
}

describe('emMinutos', () => {
  it('lê a hora que a pessoa digitou', () => {
    expect(emMinutos('08:30')).toBe(510)
    expect(emMinutos('00:00')).toBe(0)
    expect(emMinutos('23:59')).toBe(1439)
  })

  it('recusa o que não é hora', () => {
    expect(emMinutos('24:00')).toBeNull()
    expect(emMinutos('8:30')).toBeNull()
    expect(emMinutos('meio-dia')).toBeNull()
    expect(emMinutos('')).toBeNull()
  })
})

describe('lerJanela', () => {
  it('sem configuração é sem restrição, e não "em horário nenhum"', () => {
    expect(lerJanela(null)).toBeNull()
    expect(lerJanela(undefined)).toBeNull()
  })

  it('objeto torto vira null em vez de sumir com a agenda', () => {
    expect(lerJanela({ dias: [] })).toBeNull()
    expect(lerJanela({ dias: [[], [], []] })).toBeNull()
    expect(lerJanela({ dias: [[], [], [], [], [], [], [{ de: 8 }]] })).toBeNull()
    expect(lerJanela('quarta de manhã')).toBeNull()
  })

  it('lê as sete listas', () => {
    const lido = lerJanela({
      dias: [[], [{ de: '08:00', ate: '12:00' }], [], [], [], [], []],
    })
    expect(lido?.dias[1]).toEqual([{ de: '08:00', ate: '12:00' }])
    expect(lido?.dias[0]).toEqual([])
  })
})

describe('cabeNaJanela', () => {
  it('sem janela, qualquer horário do serviço serve', () => {
    expect(cabeNaJanela(null, 1, '13:00')).toBe(true)
  })

  it('sete listas vazias é "em horário nenhum" — alguém decidiu isso', () => {
    expect(cabeNaJanela(janela(() => {}), 1, '13:00')).toBe(false)
  })

  it('a grade do MGM: segunda das 12h às 14h não recebe experimental', () => {
    // segunda (1) aberta das 8h às 12h e das 14h em diante
    const grade = janela((dias) => {
      dias[1] = [
        { de: '08:00', ate: '12:00' },
        { de: '14:00', ate: '21:00' },
      ]
    })

    expect(cabeNaJanela(grade, 1, '09:00')).toBe(true)
    expect(cabeNaJanela(grade, 1, '12:00')).toBe(false)
    expect(cabeNaJanela(grade, 1, '13:00')).toBe(false)
    expect(cabeNaJanela(grade, 1, '14:00')).toBe(true)
  })

  it('quarta começa às 15h', () => {
    const grade = janela((dias) => {
      dias[3] = [{ de: '15:00', ate: '21:00' }]
    })

    expect(cabeNaJanela(grade, 3, '14:59')).toBe(false)
    expect(cabeNaJanela(grade, 3, '15:00')).toBe(true)
  })

  it('o fim da faixa é de fora: 12h não cabe em 08h-12h', () => {
    const grade = janela((dias) => {
      dias[2] = [{ de: '08:00', ate: '12:00' }]
    })
    expect(cabeNaJanela(grade, 2, '11:59')).toBe(true)
    expect(cabeNaJanela(grade, 2, '12:00')).toBe(false)
  })

  it('o dia sem faixa nenhuma não recebe', () => {
    const grade = janela((dias) => {
      dias[1] = [{ de: '08:00', ate: '21:00' }]
    })
    expect(cabeNaJanela(grade, 0, '10:00')).toBe(false)
  })

  it('faixa ilegível ou invertida não abre horário', () => {
    const invertida = janela((dias) => {
      dias[4] = [{ de: '18:00', ate: '08:00' }]
    })
    expect(cabeNaJanela(invertida, 4, '19:00')).toBe(false)

    const ilegivel = janela((dias) => {
      dias[4] = [{ de: 'oito', ate: 'nove' }]
    })
    expect(cabeNaJanela(ilegivel, 4, '08:30')).toBe(false)
  })

  it('hora torta não cabe em lugar nenhum', () => {
    const grade = janela((dias) => {
      dias[1] = [{ de: '08:00', ate: '21:00' }]
    })
    expect(cabeNaJanela(grade, 1, '25:00')).toBe(false)
  })
})

describe('diaDaSemana', () => {
  it('domingo é 0, como no resto do sistema', () => {
    // 13/set/2026 é um domingo
    expect(diaDaSemana('2026-09-13')).toBe(0)
    expect(diaDaSemana('2026-09-14')).toBe(1)
    expect(diaDaSemana('2026-09-16')).toBe(3)
  })
})
