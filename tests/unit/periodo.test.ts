import { describe, it, expect } from 'vitest'
import {
  ATALHOS, atalhoDe, periodoDaBusca, periodoPorExtenso,
} from '@/core/financeiro/periodo'

const janela = (id: string, hoje: string) =>
  ATALHOS.find((a) => a.id === id)!.janela(hoje)

describe('os atalhos de período', () => {
  const hoje = '2026-08-19'

  it('hoje e ontem são um dia só', () => {
    expect(janela('hoje', hoje)).toEqual({ de: '2026-08-19', ate: '2026-08-19' })
    expect(janela('ontem', hoje)).toEqual({ de: '2026-08-18', ate: '2026-08-18' })
  })

  /* sete dias contando hoje: 13, 14, 15, 16, 17, 18 e 19 */
  it('sete dias inclui hoje, e por isso volta seis', () => {
    expect(janela('7d', hoje)).toEqual({ de: '2026-08-13', ate: '2026-08-19' })
  })

  it('trinta dias também conta hoje como um deles', () => {
    expect(janela('30d', hoje)).toEqual({ de: '2026-07-21', ate: '2026-08-19' })
  })

  it('este mês começa no dia 1 e para em hoje', () => {
    expect(janela('mes', hoje)).toEqual({ de: '2026-08-01', ate: '2026-08-19' })
  })

  it('o mês passado é o mês inteiro que fechou', () => {
    expect(janela('mes-passado', hoje)).toEqual({ de: '2026-07-01', ate: '2026-07-31' })
  })

  /* fevereiro é o mês que quebra quem soma trinta dias para trás */
  it('o mês passado acerta fevereiro e o ano bissexto', () => {
    expect(janela('mes-passado', '2026-03-10'))
      .toEqual({ de: '2026-02-01', ate: '2026-02-28' })
    expect(janela('mes-passado', '2028-03-10'))
      .toEqual({ de: '2028-02-01', ate: '2028-02-29' })
  })

  it('o mês passado atravessa a virada do ano', () => {
    expect(janela('mes-passado', '2026-01-15'))
      .toEqual({ de: '2025-12-01', ate: '2025-12-31' })
  })

  it('reconhece qual atalho descreve uma janela', () => {
    expect(atalhoDe(janela('mes', hoje), hoje)).toBe('mes')
    expect(atalhoDe({ de: '2026-03-02', ate: '2026-03-09' }, hoje)).toBeNull()
    expect(atalhoDe(null, hoje)).toBeNull()
  })
})

describe('a janela pedida pela URL', () => {
  /*
   * Nenhuma é uma resposta legítima, e é o padrão. Uma lista de cobranças que
   * abre filtrada por "este mês" esconde quem deve desde junho, que é
   * exatamente a pessoa para quem se liga hoje.
   */
  it('sem data nenhuma não filtra', () => {
    expect(periodoDaBusca(undefined, undefined)).toBeNull()
    expect(periodoDaBusca('', '')).toBeNull()
  })

  it('as duas datas viram a janela', () => {
    expect(periodoDaBusca('2026-01-01', '2026-01-31'))
      .toEqual({ de: '2026-01-01', ate: '2026-01-31' })
  })

  /* quem digitou 30/09 a 01/09 quis setembro, e não uma lista vazia */
  it('datas fora de ordem se invertem em vez de devolverem nada', () => {
    expect(periodoDaBusca('2026-09-30', '2026-09-01'))
      .toEqual({ de: '2026-09-01', ate: '2026-09-30' })
  })

  it('uma ponta só é uma pergunta legítima', () => {
    expect(periodoDaBusca('2026-09-01', undefined))
      .toEqual({ de: '2026-09-01', ate: '9999-12-31' })
    expect(periodoDaBusca(undefined, '2026-09-01'))
      .toEqual({ de: '0001-01-01', ate: '2026-09-01' })
  })

  it('o que não é data some, e não vira filtro torto', () => {
    expect(periodoDaBusca('ontem', 'amanhã')).toBeNull()
    expect(periodoDaBusca('2026-13-01', undefined)).toBeNull()
    expect(periodoDaBusca('2026-01-40', undefined)).toBeNull()
    expect(periodoDaBusca('01/09/2026', undefined)).toBeNull()
  })
})

describe('a janela por extenso', () => {
  it('um dia só se lê como um dia', () => {
    expect(periodoPorExtenso({ de: '2026-01-19', ate: '2026-01-19' }))
      .toBe('em 19/01/26')
  })

  it('a janela fechada se lê de ponta a ponta', () => {
    expect(periodoPorExtenso({ de: '2026-01-01', ate: '2026-01-31' }))
      .toBe('de 01/01/26 a 31/01/26')
  })

  it('a ponta aberta não mostra a data sentinela', () => {
    expect(periodoPorExtenso({ de: '2026-09-01', ate: '9999-12-31' }))
      .toBe('de 01/09/26 em diante')
    expect(periodoPorExtenso({ de: '0001-01-01', ate: '2026-09-01' }))
      .toBe('até 01/09/26')
  })

  it('sem janela não há frase', () => {
    expect(periodoPorExtenso(null)).toBeNull()
  })
})
