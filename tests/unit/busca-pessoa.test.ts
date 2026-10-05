import { describe, expect, it } from 'vitest'
import { digitosDaBusca, filtrarPorNome, semAcento } from '@/core/pessoas/busca'

/**
 * A busca do modal de encaixe filtra no navegador; a da lista de pessoas filtra
 * no banco, com `nome_busca`. As duas precisam achar a mesma pessoa, senão o
 * cadastro parece sumir de uma tela para a outra.
 */
describe('normalização do nome', () => {
  it('acento e caixa não distinguem ninguém', () => {
    expect(semAcento('Cecília')).toBe('cecilia')
    expect(semAcento('NATHÁLIA PEREIRA')).toBe('nathalia pereira')
    expect(semAcento('AMILCAR JOÃO GAY FILHO')).toBe('amilcar joao gay filho')
  })
})

describe('filtrar por nome', () => {
  const gente = [
    { nome: 'Cecília Salzano' },
    { nome: 'Amilcar João Gay Filho' },
    { nome: 'Emilia Hiroco Endo Prupst' },
    { nome: 'Vera Lucia Pereira Neto' },
  ]

  it('acha por começo de nome, sem acento', () => {
    expect(filtrarPorNome(gente, 'ceci').map((g) => g.nome)).toEqual(['Cecília Salzano'])
  })

  it('acha pelo meio: é assim que se procura quem se conhece de vista', () => {
    expect(filtrarPorNome(gente, 'salzano').map((g) => g.nome)).toEqual(['Cecília Salzano'])
    expect(filtrarPorNome(gente, 'joao').map((g) => g.nome)).toEqual(['Amilcar João Gay Filho'])
  })

  it('termo vazio não devolve a conta inteira', () => {
    expect(filtrarPorNome(gente, '')).toEqual([])
    expect(filtrarPorNome(gente, '   ')).toEqual([])
  })

  it('corta em oito, que é o que cabe no modal', () => {
    const muitos = Array.from({ length: 30 }, (_, i) => ({ nome: `Maria ${i}` }))
    expect(filtrarPorNome(muitos, 'maria')).toHaveLength(8)
  })
})

describe('digitosDaBusca', () => {
  const telefone = '44998775978'
  const acha = (termo: string) => {
    const d = digitosDaBusca(termo)
    return d !== null && telefone.includes(d)
  }

  it('acha a sequência seguida em qualquer ponto do número', () => {
    expect(acha('759')).toBe(true)
    expect(acha('5978')).toBe(true)
    expect(acha('4499')).toBe(true)
    expect(acha('(44) 9987')).toBe(true)
    expect(acha('5544998775978')).toBe(true)
  })

  it('não acha dígitos fora de ordem ou picados', () => {
    expect(acha('779')).toBe(false)
  })

  it('texto com letra é busca por nome, e menos de três dígitos não busca', () => {
    expect(digitosDaBusca('ana 12')).toBeNull()
    expect(digitosDaBusca('12')).toBeNull()
  })
})
