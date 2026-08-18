import { describe, it, expect } from 'vitest'
import { POSICOES_PADRAO, ordenarPosicoes, proximaOrdem } from '@/core/avaliacao/posicoes'
import { parPadrao, datasComFoto } from '@/core/avaliacao/comparar'

describe('posições da avaliação', () => {
  it('as seis de partida começam pela frente e terminam nos pés', () => {
    expect(POSICOES_PADRAO[0]).toBe('Frente')
    expect(POSICOES_PADRAO.at(-1)).toBe('Pés')
    expect(POSICOES_PADRAO).toHaveLength(6)
  })

  it('ordena pela ordem, e pelo nome quando a ordem empata', () => {
    const linhas = [
      { nome: 'Costas', ordem: 2 },
      { nome: 'Frente', ordem: 1 },
      { nome: 'Abdômen', ordem: 2 },
    ]
    expect(ordenarPosicoes(linhas).map((p) => p.nome))
      .toEqual(['Frente', 'Abdômen', 'Costas'])
  })

  it('não mexe na lista que recebeu', () => {
    const linhas = [{ nome: 'Costas', ordem: 2 }, { nome: 'Frente', ordem: 1 }]
    ordenarPosicoes(linhas)
    expect(linhas[0].nome).toBe('Costas')
  })

  it('a posição nova entra no fim, e a lista vazia começa em 1', () => {
    expect(proximaOrdem([{ nome: 'Frente', ordem: 3 }])).toBe(4)
    expect(proximaOrdem([])).toBe(1)
  })
})

describe('par de comparação', () => {
  it('compara a primeira com a última, que é onde a diferença aparece', () => {
    expect(parPadrao(['2022-12-12', '2020-11-30', '2021-10-13']))
      .toEqual({ antes: '2020-11-30', depois: '2022-12-12' })
  })

  it('com uma avaliação só, não há o que comparar', () => {
    expect(parPadrao(['2020-11-30'])).toBeNull()
    expect(parPadrao([])).toBeNull()
  })
})

describe('datas em que a posição foi fotografada', () => {
  const avaliacoes = [
    { data: '2020-11-30', fotos: [{ posicaoId: 'frente' }, { posicaoId: 'costas' }] },
    { data: '2021-10-13', fotos: [{ posicaoId: 'frente' }] },
    { data: '2022-12-12', fotos: [{ posicaoId: 'costas' }] },
  ]

  it('devolve só as visitas em que aquela posição tem foto', () => {
    expect(datasComFoto(avaliacoes, 'frente')).toEqual(['2020-11-30', '2021-10-13'])
    expect(datasComFoto(avaliacoes, 'costas')).toEqual(['2020-11-30', '2022-12-12'])
  })

  it('posição que ninguém fotografou devolve lista vazia, e não erro', () => {
    expect(datasComFoto(avaliacoes, 'pes')).toEqual([])
  })
})
