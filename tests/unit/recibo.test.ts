import { describe, it, expect } from 'vitest'
import {
  descricaoDoRecibo, emitenteCompleto, montarCorpo, numeroFormatado,
  podeCancelar, podeCorrigir, porExtenso,
} from '@/core/recibo/recibo'

describe('o número do recibo', () => {
  it('leva a série na frente e zeros à esquerda', () => {
    expect(numeroFormatado('A', 42)).toBe('A-000042')
  })

  it('a correção aparece na linha, e não vira número novo', () => {
    expect(descricaoDoRecibo({ serie: 'A', numero: 42, versao: 1, status: 'valido' }))
      .toBe('A-000042')
    expect(descricaoDoRecibo({ serie: 'A', numero: 42, versao: 2, status: 'valido' }))
      .toBe('A-000042 (correção 2)')
  })
})

describe('o valor por extenso', () => {
  it('escreve os valores da tabela do cliente', () => {
    expect(porExtenso(45000)).toBe('quatrocentos e cinquenta reais')
    expect(porExtenso(73500)).toBe('setecentos e trinta e cinco reais')
    expect(porExtenso(104000)).toBe('mil e quarenta reais')
    expect(porExtenso(207000)).toBe('dois mil e setenta reais')
    expect(porExtenso(936000)).toBe('nove mil trezentos e sessenta reais')
  })

  it('o "e" antes do resto é a regra que todo mundo erra', () => {
    // redondo ou menor que cem leva o "e"
    expect(porExtenso(150000)).toBe('mil e quinhentos reais')
    expect(porExtenso(102000)).toBe('mil e vinte reais')
    // resto com dezena e unidade não leva
    expect(porExtenso(150100)).toBe('mil quinhentos e um reais')
  })

  it('cem vira cento assim que houver dezena depois', () => {
    expect(porExtenso(10000)).toBe('cem reais')
    expect(porExtenso(10100)).toBe('cento e um reais')
  })

  it('um real é singular, e um centavo também', () => {
    expect(porExtenso(100)).toBe('um real')
    expect(porExtenso(1)).toBe('um centavo')
    expect(porExtenso(101)).toBe('um real e um centavo')
  })

  it('centavos entram depois do "e"', () => {
    expect(porExtenso(19550)).toBe('cento e noventa e cinco reais e cinquenta centavos')
  })

  it('zero não é caso de recibo, e mesmo assim tem resposta', () => {
    expect(porExtenso(0)).toBe('zero reais')
  })
})

describe('o emitente', () => {
  const base = {
    razaoSocial: 'MGM Pilates Ltda', documento: '12345678000190',
    endereco: 'Rua das Acácias, 204', telefone: '1133334444',
    nomeDaConta: 'MGM Pilates',
  }

  it('precisa de razão social e documento para o papel valer', () => {
    expect(emitenteCompleto(base)).toBe(true)
    expect(emitenteCompleto({ ...base, documento: null })).toBe(false)
    expect(emitenteCompleto({ ...base, razaoSocial: '  ' })).toBe(false)
  })

  it('sem razão social, o corpo cai no nome da conta', () => {
    const corpo = montarCorpo({
      emitente: { ...base, razaoSocial: null },
      pagador: { nome: 'Marina', documento: null, matricula: null, endereco: null },
      referente: 'Mensal 2x por semana, setembro de 2026',
      valorCent: 73500, forma: 'Pix', recebidoEm: '2026-09-05',
      emitidoPor: 'Gabriel', emitidoEm: '2026-09-05T12:00:00Z',
    })
    expect(corpo.emitenteNome).toBe('MGM Pilates')
  })

  it('o corpo carrega o extenso junto, e não uma promessa de calculá-lo', () => {
    const corpo = montarCorpo({
      emitente: base,
      pagador: { nome: 'Marina Ferraz', documento: '52998224725', matricula: '042', endereco: 'Rua A, 10' },
      referente: 'Mensal 2x por semana, setembro de 2026',
      valorCent: 73500, forma: 'Pix', recebidoEm: '2026-09-05',
      emitidoPor: 'Recepção', emitidoEm: '2026-09-05T12:00:00Z',
    })
    expect(corpo.valorPorExtenso).toBe('setecentos e trinta e cinco reais')
    expect(corpo.pagadorMatricula).toBe('042')
  })
})

describe('o que se pode fazer com um recibo', () => {
  it('só o válido é cancelado ou corrigido', () => {
    expect(podeCancelar('valido')).toBe(true)
    expect(podeCancelar('cancelado')).toBe(false)
    // corrigir o substituído corrigiria uma versão que ninguém tem na mão
    expect(podeCorrigir('substituido')).toBe(false)
  })
})
