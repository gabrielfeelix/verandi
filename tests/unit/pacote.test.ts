import { describe, it, expect } from 'vitest'
import { aulasAFazerNoMes, estadoDoPacote, fraseDoSaldo, segundaDe } from '@/core/contratos/pacote'

const base = {
  contratadas: 10, usadas: 3, temAgendada: false,
  ultimoUso: '2026-10-01', inicio: '2026-09-01', hoje: '2026-10-07',
}

describe('pacote de aulas', () => {
  it('saldo folgado com aula marcada não pede nada', () => {
    expect(estadoDoPacote({ ...base, temAgendada: true }).aviso).toBeNull()
  })

  it('restam 2 ou menos é acabando', () => {
    expect(estadoDoPacote({ ...base, usadas: 8 }).aviso).toBe('acabando')
    expect(estadoDoPacote({ ...base, usadas: 7, temAgendada: true }).aviso).toBeNull()
  })

  it('usou todas, ou passou do total, é esgotado', () => {
    expect(estadoDoPacote({ ...base, usadas: 10 }).aviso).toBe('esgotado')
    const e = estadoDoPacote({ ...base, usadas: 11 })
    expect(e.aviso).toBe('esgotado')
    expect(e.restantes).toBe(0)
  })

  it('saldo sem nada marcado é aula a fazer, e conta os dias sem uso', () => {
    const e = estadoDoPacote(base)
    expect(e.aviso).toBe('parado')
    expect(e.diasSemUsar).toBe(6)
  })

  it('aula marcada à frente tira do parado', () => {
    expect(estadoDoPacote({ ...base, ultimoUso: '2026-08-01', temAgendada: true }).aviso).toBeNull()
  })

  it('nunca usou conta do início do contrato', () => {
    expect(estadoDoPacote({ ...base, usadas: 0, ultimoUso: null, inicio: '2026-09-10' }).diasSemUsar)
      .toBe(27)
  })

  it('pouco saldo vence parado: a conversa é a renovação', () => {
    expect(estadoDoPacote({ ...base, usadas: 9, ultimoUso: '2026-08-01' }).aviso).toBe('acabando')
  })

  it('a frase do saldo', () => {
    expect(fraseDoSaldo({ contratadas: 10, usadas: 7, restantes: 3 })).toBe('7 de 10 usadas, restam 3')
    expect(fraseDoSaldo({ contratadas: 10, usadas: 9, restantes: 1 })).toBe('9 de 10 usadas, resta 1')
    expect(fraseDoSaldo({ contratadas: 10, usadas: 11, restantes: 0 })).toBe('10 de 10 usadas, nenhuma restante')
  })
})

describe('aulas do plano semanal a fazer no mês', () => {
  it('a Thais: 2x por semana com um horário fixo, quatro semanas até o fim de outubro', () => {
    // hoje 07/10 (quarta); segundas 05, 12, 19, 26
    const porSemana = new Map([['2026-10-05', 1], ['2026-10-12', 1], ['2026-10-19', 1], ['2026-10-26', 1]])
    expect(aulasAFazerNoMes(2, '2026-10-07', porSemana)).toBe(4)
  })

  it('semana cheia não conta, e a frequência não fica negativa', () => {
    const porSemana = new Map([['2026-10-05', 3], ['2026-10-12', 2], ['2026-10-19', 2], ['2026-10-26', 2]])
    expect(aulasAFazerNoMes(2, '2026-10-07', porSemana)).toBe(0)
  })

  it('sem nada marcado, conta a frequência em cada semana', () => {
    expect(aulasAFazerNoMes(1, '2026-10-07', new Map())).toBe(4)
  })

  it('segunda-feira de qualquer dia', () => {
    expect(segundaDe('2026-10-07')).toBe('2026-10-05')
    expect(segundaDe('2026-10-05')).toBe('2026-10-05')
    expect(segundaDe('2026-10-11')).toBe('2026-10-05')
  })
})
