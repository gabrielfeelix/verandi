import { describe, it, expect } from 'vitest'
import { telefoneMascarado } from '@/core/pessoas/telefone'
import { situacaoDe } from '@/core/pessoas/situacao'

describe('telefone mascarado', () => {
  it('esconde o miolo do celular e mantém o fim', () => {
    expect(telefoneMascarado('11999103312')).toBe('(11) 9••••-3312')
  })

  it('aceita o número já formatado', () => {
    expect(telefoneMascarado('(11) 99910-3312')).toBe('(11) 9••••-3312')
  })

  it('fixo de dez dígitos não inventa o nono', () => {
    expect(telefoneMascarado('1133334444')).toBe('(11) ••••-4444')
  })

  it('sem número é null, e não string vazia', () => {
    // a tela mostra "—" para null e "cadastrou errado" para o resto: são
    // situações diferentes e não podem colapsar na mesma
    expect(telefoneMascarado(null)).toBeNull()
    expect(telefoneMascarado('')).toBeNull()
    expect(telefoneMascarado('   ')).toBeNull()
  })
})

describe('situação na lista', () => {
  const hoje = new Date('2026-08-13T12:00:00Z')
  const base = { ativo: true, faltasRecentes: 0, vencimentoPlano: null }

  it('quem parou é inativa, mesmo faltando e com plano vencendo', () => {
    expect(situacaoDe(
      { ativo: false, faltasRecentes: 5, vencimentoPlano: '2026-08-14' }, hoje,
    ).rotulo).toBe('inativa')
  })

  it('plano vencendo ganha de faltando: é o único com prazo', () => {
    expect(situacaoDe(
      { ...base, faltasRecentes: 3, vencimentoPlano: '2026-08-20' }, hoje,
    ).rotulo).toBe('plano vencendo')
  })

  it('plano longe não acusa nada', () => {
    expect(situacaoDe({ ...base, vencimentoPlano: '2026-12-01' }, hoje).rotulo)
      .toBe('ativa')
  })

  it('duas faltas em trinta dias é quem está sumindo', () => {
    expect(situacaoDe({ ...base, faltasRecentes: 2 }, hoje).rotulo).toBe('faltando')
    expect(situacaoDe({ ...base, faltasRecentes: 1 }, hoje).rotulo).toBe('ativa')
  })

  it('plano já vencido continua sendo aviso, não silêncio', () => {
    expect(situacaoDe({ ...base, vencimentoPlano: '2026-07-01' }, hoje).rotulo)
      .toBe('plano vencendo')
  })
})
