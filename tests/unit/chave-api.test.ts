import { describe, it, expect } from 'vitest'
import {
  PREFIXO, estadoDaChave, prefixoVisivel, segredoDoCabecalho,
} from '@/core/api/chave'
import { hashDe, novaChave } from '@/server/api/chave'

describe('o formato da chave', () => {
  it('nasce com prefixo reconhecível', () => {
    const { segredo } = novaChave()
    expect(segredo.startsWith(PREFIXO)).toBe(true)
  })

  it('é longa o suficiente para adivinhar não ser caminho', () => {
    // 32 bytes em base64url dão 43 caracteres, o mesmo tamanho do token de
    // convite. Encurtar isto é a mudança que ninguém percebe e que abre a porta
    const { segredo } = novaChave()
    expect(segredo.length).toBeGreaterThanOrEqual(PREFIXO.length + 40)
  })

  it('duas chaves nunca saem iguais', () => {
    const n = 200
    const chaves = new Set(Array.from({ length: n }, () => novaChave().segredo))
    expect(chaves.size).toBe(n)
  })

  it('o que vai para o banco é o hash, e ele não devolve o segredo', () => {
    const { segredo, hash } = novaChave()
    expect(hash).not.toContain(segredo)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    // mesma entrada, mesmo hash: é o que faz a busca por chave funcionar
    expect(hashDe(segredo)).toBe(hash)
  })

  it('o prefixo visível identifica sem revelar', () => {
    const { segredo, prefixo } = novaChave()
    expect(segredo.startsWith(prefixo)).toBe(true)
    expect(prefixo.length).toBeLessThan(segredo.length / 2)
    expect(prefixoVisivel(segredo)).toBe(prefixo)
  })
})

describe('o segredo que vem no cabeçalho', () => {
  const { segredo } = novaChave()

  it('aceita com e sem "Bearer", porque metade dos clientes manda de cada jeito', () => {
    expect(segredoDoCabecalho(`Bearer ${segredo}`)).toBe(segredo)
    expect(segredoDoCabecalho(`bearer ${segredo}`)).toBe(segredo)
    expect(segredoDoCabecalho(segredo)).toBe(segredo)
    expect(segredoDoCabecalho(`  Bearer   ${segredo}  `)).toBe(segredo)
  })

  it('recusa antes de ir ao banco o que não pode ser chave', () => {
    /*
     * Isto não é preciosismo de formato: sem o corte aqui, todo cabeçalho vazio
     * de robô mal configurado vira uma consulta ao banco, e um `undefined`
     * literal (que os clientes de API mandam mais do que se imagina) também.
     */
    for (const lixo of [
      null, '', '   ', 'Bearer', 'Bearer ', 'undefined', 'null',
      'Basic dXNlcjpzZW5oYQ==', 'vr_curto', segredo.replace(PREFIXO, 'xx_'),
    ]) {
      expect(segredoDoCabecalho(lixo), `deveria recusar ${JSON.stringify(lixo)}`)
        .toBeNull()
    }
  })
})

describe('o estado da chave', () => {
  it('separa revogada de inexistente, que a API junta de propósito', () => {
    expect(estadoDaChave(null)).toBe('inexistente')
    expect(estadoDaChave({ revogadaEm: '2026-08-14T12:00:00Z' })).toBe('revogada')
    expect(estadoDaChave({ revogadaEm: null })).toBe('valida')
  })
})
