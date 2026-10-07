import { describe, it, expect } from 'vitest'
import { estadoDoPacote, fraseDoSaldo } from '@/core/contratos/pacote'

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
