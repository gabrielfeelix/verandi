import { describe, expect, it } from 'vitest'
import { aulasAFazerNoMes, diaDoHorarioNaSemana, estadoDoPacote } from '@/core/contratos/pacote'

describe('aulasAFazerNoMes', () => {
  // quarta, 07/out/2026: semanas de 05, 12, 19 e 26 de outubro
  const hoje = '2026-10-07'

  it('conta o que falta em cada semana até o fim do mês', () => {
    const marcadas = new Map([['2026-10-05', 1], ['2026-10-12', 2]])
    expect(aulasAFazerNoMes(2, hoje, marcadas)).toBe(1 + 0 + 2 + 2)
  })

  it('contrato que termina no meio do mês não deve as semanas depois do fim', () => {
    expect(aulasAFazerNoMes(2, hoje, new Map(), '2026-10-16')).toBe(2 + 2)
  })

  it('fim depois do mês não muda a conta', () => {
    expect(aulasAFazerNoMes(1, hoje, new Map(), '2026-12-31')).toBe(4)
  })
})

describe('estadoDoPacote', () => {
  const base = { temAgendada: false, ultimoUso: null, inicio: '2026-09-01', hoje: '2026-10-07' }

  it('sem saldo é esgotado, pouco saldo é acabando, saldo parado é aulas a fazer', () => {
    expect(estadoDoPacote({ ...base, contratadas: 10, usadas: 10 }).aviso).toBe('esgotado')
    expect(estadoDoPacote({ ...base, contratadas: 10, usadas: 8 }).aviso).toBe('acabando')
    expect(estadoDoPacote({ ...base, contratadas: 10, usadas: 3 }).aviso).toBe('parado')
    expect(estadoDoPacote({ ...base, contratadas: 10, usadas: 3, temAgendada: true }).aviso).toBeNull()
  })
})

describe('diaDoHorarioNaSemana', () => {
  it('leva a segunda ao dia do horário, com domingo no fim da semana', () => {
    expect(diaDoHorarioNaSemana('2026-10-26', 1)).toBe('2026-10-26')
    expect(diaDoHorarioNaSemana('2026-10-26', 6)).toBe('2026-10-31')
    expect(diaDoHorarioNaSemana('2026-10-26', 0)).toBe('2026-11-01')
  })
})
