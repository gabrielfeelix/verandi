import { describe, it, expect } from 'vitest'
import { nomeDeRemetente, PRODUTO } from '@/core/email/remetente'

/*
 * Caractere de controle aparece aqui como `\u0007`, nunca como o byte literal.
 * Byte invisível dentro de um teste de segurança é pior que teste faltando: o
 * primeiro editor que normalizar o arquivo apaga a proteção e o teste continua
 * verde.
 */
const CONTROLE = /[\u0000-\u001F\u007F]/

describe('nome de remetente', () => {
  it('junta o nome da conta ao do produto', () => {
    expect(nomeDeRemetente('Estúdio Lótus')).toBe('Estúdio Lótus via Verandi')
  })

  it('tira quebra de linha, que é injeção de cabeçalho', () => {
    // `\r\n` num cabeçalho abre um cabeçalho novo: `Bcc:` forjado sai daqui
    expect(nomeDeRemetente('Lótus\r\nBcc: vitima@exemplo.com'))
      .toBe('Lótus Bcc: vitima@exemplo.com via Verandi')
    expect(nomeDeRemetente('Lótus\nBcc: x@y.z')).not.toMatch(CONTROLE)
    expect(nomeDeRemetente('a\rb')).not.toMatch(CONTROLE)
  })

  it('tira caractere de controle que não é quebra de linha', () => {
    const sujo = 'Ló\u0007tus\u001B[31m\u007F'
    expect(nomeDeRemetente(sujo)).not.toMatch(CONTROLE)
  })

  it('colapsa espaço repetido em vez de deixar buraco no nome', () => {
    expect(nomeDeRemetente('Estúdio    Lótus')).toBe('Estúdio Lótus via Verandi')
    expect(nomeDeRemetente('  Lótus  ')).toBe('Lótus via Verandi')
  })

  it('conta sem nome utilizável vira só o produto', () => {
    // sem isto sairia " via Verandi", que parece defeito para quem recebe
    expect(nomeDeRemetente('')).toBe(PRODUTO)
    expect(nomeDeRemetente('   ')).toBe(PRODUTO)
    expect(nomeDeRemetente('\r\n\t')).toBe(PRODUTO)
    expect(nomeDeRemetente(null)).toBe(PRODUTO)
    expect(nomeDeRemetente(undefined)).toBe(PRODUTO)
  })

  it('corta nome longo demais para caber num cabeçalho', () => {
    const gigante = 'Estúdio '.repeat(40)
    const saida = nomeDeRemetente(gigante)
    expect(saida.length).toBeLessThanOrEqual(78)
    expect(saida.endsWith(` via ${PRODUTO}`)).toBe(true)
    // corta a conta, nunca o produto — sem o produto o "via" fica órfão
    expect(saida).toContain('Estúdio')
  })

  it('não repete o produto quando a conta já se chama assim', () => {
    expect(nomeDeRemetente('Verandi')).toBe('Verandi')
    expect(nomeDeRemetente('verandi')).toBe('verandi')
  })

  it('tira aspas e sinal de maior/menor, que delimitam cabeçalho', () => {
    expect(nomeDeRemetente('Lótus "A" <x@y.z>')).toBe('Lótus A x@y.z via Verandi')
  })
})
