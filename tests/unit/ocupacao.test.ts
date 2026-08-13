import { describe, it, expect } from 'vitest'
import { calcularOcupacao } from '@/core/agenda/ocupacao'
import { avaliarEncaixe, temVagaParaOferecer } from '@/core/agenda/encaixe'

describe('calcularOcupacao', () => {
  it('conta quem ocupa a vaga', () => {
    const o = calcularOcupacao(4, ['esperada', 'presente', 'confirmada'])
    expect(o).toEqual({
      capacidade: 4, ocupadas: 3, livres: 1, lotada: false, excedida: false,
    })
  })

  it('quem avisou que não vem LIBERA a vaga', () => {
    // é o que faz a confirmação por bot valer: avisou, a vaga abre para reposição
    const o = calcularOcupacao(4, ['presente', 'falta_avisada', 'falta_avisada'])
    expect(o.ocupadas).toBe(1)
    expect(o.livres).toBe(3)
  })

  it('cancelada libera a vaga', () => {
    expect(calcularOcupacao(2, ['cancelada', 'presente']).ocupadas).toBe(1)
  })

  it('licença NÃO libera — a pessoa mantém o horário dela', () => {
    expect(calcularOcupacao(4, ['licenca', 'presente']).ocupadas).toBe(2)
  })

  it('falta sem aviso não libera', () => {
    expect(calcularOcupacao(4, ['falta', 'presente']).ocupadas).toBe(2)
  })

  it('lotada quando bate a capacidade', () => {
    const o = calcularOcupacao(2, ['presente', 'presente'])
    expect(o).toMatchObject({ ocupadas: 2, livres: 0, lotada: true, excedida: false })
  })

  it('excedida quando passa, e livres nunca fica negativo', () => {
    // acontece em dado histórico importado: a sessão de fato teve mais gente
    const o = calcularOcupacao(2, ['presente', 'presente', 'presente', 'presente'])
    expect(o.ocupadas).toBe(4)
    expect(o.livres).toBe(0)
    expect(o.excedida).toBe(true)
  })

  it('sessão vazia', () => {
    expect(calcularOcupacao(4, [])).toMatchObject({ ocupadas: 0, livres: 4, lotada: false })
  })
})

describe('avaliarEncaixe', () => {
  it('cabe quando há vaga', () => {
    const o = calcularOcupacao(4, ['presente'])
    expect(avaliarEncaixe(o, false)).toEqual({ cabe: true })
  })

  it('NÃO cabe quando lotada — a saída é aumentar a capacidade', () => {
    // 5 vagas com 5 pessoas é indisponível. A sexta pessoa não vê o horário,
    // e o bot não oferece. Quem abre vaga é o profissional, subindo a
    // capacidade daquele dia — aí a vaga passa a existir de verdade.
    const o = calcularOcupacao(5, ['presente', 'presente', 'presente', 'esperada', 'esperada'])
    expect(avaliarEncaixe(o, false)).toEqual({
      cabe: false, motivo: 'lotada', podeAbrirVaga: true,
    })
  })

  it('a mesma pessoa duas vezes é recusa sem saída', () => {
    const o = calcularOcupacao(4, ['presente'])
    expect(avaliarEncaixe(o, true)).toEqual({
      cabe: false, motivo: 'ja_participa', podeAbrirVaga: false,
    })
  })

  it('quem avisou que não vem abre vaga para a reposição', () => {
    const o = calcularOcupacao(2, ['presente', 'falta_avisada'])
    expect(avaliarEncaixe(o, false)).toEqual({ cabe: true })
  })
})

describe('temVagaParaOferecer', () => {
  it('cheio NÃO é resultado de busca — nem na tela, nem para o bot', () => {
    expect(temVagaParaOferecer(calcularOcupacao(2, ['presente', 'presente']))).toBe(false)
    expect(temVagaParaOferecer(calcularOcupacao(2, ['presente']))).toBe(true)
  })

  it('sessão histórica acima da capacidade também não oferece', () => {
    const o = calcularOcupacao(2, ['presente', 'presente', 'presente'])
    expect(temVagaParaOferecer(o)).toBe(false)
  })
})
