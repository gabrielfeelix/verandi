import { describe, it, expect } from 'vitest'
import { cpfValido, mascararCpf, soDigitosCpf } from '@/core/pessoas/documento'
import {
  fimDoContrato, diasParados, fimProrrogado, saldoDoPacote, proximoVencimento,
} from '@/core/contratos/contrato'

describe('CPF', () => {
  it('aceita documento com dígito certo, com ou sem pontuação', () => {
    expect(cpfValido('390.533.447-05')).toBe(true)
    expect(cpfValido('39053344705')).toBe(true)
  })

  it('recusa dígito verificador errado', () => {
    // é o caso que só aparece na hora de emitir recibo, que é tarde
    expect(cpfValido('390.533.447-06')).toBe(false)
  })

  it('recusa os onze dígitos iguais, que passam na conta e não existem', () => {
    expect(cpfValido('111.111.111-11')).toBe(false)
    expect(cpfValido('00000000000')).toBe(false)
  })

  it('recusa tamanho que não é de CPF', () => {
    expect(cpfValido('3905334470')).toBe(false)
    expect(cpfValido('')).toBe(false)
  })

  it('escreve como a pessoa lê, e guarda como o banco quer', () => {
    expect(mascararCpf('39053344705')).toBe('390.533.447-05')
    expect(mascararCpf('390533')).toBe('390.533')
    expect(soDigitosCpf('390.533.447-05')).toBe('39053344705')
  })
})

describe('fim do contrato', () => {
  it('mensal não tem fim previsto: ele renova sozinho', () => {
    expect(fimDoContrato('2026-09-01', { recorrencia: 'mensal', validadeMeses: null }))
      .toBeNull()
  })

  it('trimestral acaba três meses depois, no dia anterior', () => {
    // até 30/11 e não 01/12: o contrato de três meses cobre setembro, outubro
    // e novembro, e não um dia de dezembro
    expect(fimDoContrato('2026-09-01', { recorrencia: 'trimestral', validadeMeses: null }))
      .toBe('2026-11-30')
  })

  it('anual acaba onze meses e vinte e nove dias depois', () => {
    expect(fimDoContrato('2026-09-01', { recorrencia: 'anual', validadeMeses: null }))
      .toBe('2027-08-31')
  })

  it('o pacote acaba pela validade dele, não pela recorrência', () => {
    expect(fimDoContrato('2026-09-01', { recorrencia: 'pacote', validadeMeses: 6 }))
      .toBe('2027-02-28')
  })

  it('a avulsa acaba no mesmo dia', () => {
    expect(fimDoContrato('2026-09-01', { recorrencia: 'avulsa', validadeMeses: null }))
      .toBe('2026-09-01')
  })

  it('não escorrega quando o mês seguinte é mais curto', () => {
    // 31/01 + 1 mês em JavaScript vira 03/03, e o contrato passaria a durar
    // dois dias a mais do que foi vendido
    expect(fimDoContrato('2026-01-31', { recorrencia: 'trimestral', validadeMeses: null }))
      .toBe('2026-04-30')
  })
})

describe('pausa', () => {
  it('conta os dias parados, com as duas pontas dentro', () => {
    expect(diasParados([{ inicio: '2026-09-01', fim: '2026-09-30' }])).toBe(30)
  })

  it('soma pausas separadas', () => {
    expect(diasParados([
      { inicio: '2026-09-01', fim: '2026-09-30' },
      { inicio: '2026-12-01', fim: '2026-12-10' },
    ])).toBe(40)
  })

  it('pausa em aberto ainda não conta: não se sabe quantos dias serão', () => {
    expect(diasParados([{ inicio: '2026-09-01', fim: null }])).toBe(0)
  })

  it('o fim anda pelos dias parados, que é o que a pessoa espera ao voltar', () => {
    expect(fimProrrogado('2026-12-31', [{ inicio: '2026-09-01', fim: '2026-09-30' }]))
      .toBe('2027-01-30')
  })

  it('contrato sem fim previsto continua sem fim depois da pausa', () => {
    expect(fimProrrogado(null, [{ inicio: '2026-09-01', fim: '2026-09-30' }]))
      .toBeNull()
  })
})

describe('saldo do pacote', () => {
  it('desconta o que já foi usado', () => {
    expect(saldoDoPacote(10, 3)).toEqual({ usadas: 3, restantes: 7, acabou: false })
  })

  it('avisa quando acabou, e não devolve número negativo', () => {
    // pacote estourado acontece: a recepção encaixa a décima primeira antes de
    // renovar, e "restam -1 sessões" não é frase que alguém escreve
    expect(saldoDoPacote(10, 12)).toEqual({ usadas: 12, restantes: 0, acabou: true })
  })

  it('contrato que não é pacote não tem saldo', () => {
    expect(saldoDoPacote(null, 5)).toBeNull()
  })
})

describe('vencimento', () => {
  it('cai no dia escolhido do mês seguinte', () => {
    expect(proximoVencimento('2026-09-03', 5)).toBe('2026-09-05')
  })

  it('já passou no mês, então vai para o mês que vem', () => {
    expect(proximoVencimento('2026-09-10', 5)).toBe('2026-10-05')
  })

  it('dia 31 em mês de 30 cai no último dia, e não escorrega para o mês seguinte', () => {
    expect(proximoVencimento('2026-11-15', 31)).toBe('2026-11-30')
  })

  it('sem dia de vencimento não há data para cobrar', () => {
    expect(proximoVencimento('2026-09-03', null)).toBeNull()
  })
})
