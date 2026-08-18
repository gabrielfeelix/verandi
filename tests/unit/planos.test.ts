import { describe, it, expect } from 'vitest'
import { emReais, emCentavos, precoAplicado, comoCobra } from '@/core/planos/plano'

describe('dinheiro', () => {
  it('escreve centavos como a recepção lê em voz alta', () => {
    expect(emReais(73500)).toBe('R$ 735,00')
    expect(emReais(198000)).toBe('R$ 1.980,00')
    expect(emReais(0)).toBe('R$ 0,00')
    expect(emReais(5)).toBe('R$ 0,05')
  })

  it('lê o que a pessoa digita, com vírgula, ponto ou cifrão', () => {
    expect(emCentavos('735,00')).toBe(73500)
    expect(emCentavos('735')).toBe(73500)
    expect(emCentavos('1.980,00')).toBe(198000)
    expect(emCentavos('R$ 195,50')).toBe(19550)
  })

  it('recusa o que não é número, em vez de virar zero', () => {
    // zero silencioso é o defeito clássico daqui: o plano entra valendo nada e
    // só se descobre na primeira cobrança
    expect(emCentavos('')).toBeNull()
    expect(emCentavos('abc')).toBeNull()
    expect(emCentavos('-10')).toBeNull()
  })

  it('não perde centavo no caminho de ida e volta', () => {
    for (const cent of [1, 99, 19500, 660_00, 198000]) {
      expect(emCentavos(emReais(cent))).toBe(cent)
    }
  })
})

describe('preço aplicado', () => {
  const fisio = {
    recorrencia: 'avulsa' as const, parcelas: 1,
    precoVinculadoCent: 19500, precoAvulsoCent: 23000,
    frequenciaSemanal: null, sessoesNoPacote: null, validadeMeses: null,
  }

  it('quem já é cliente de outra modalidade paga o preço de vínculo', () => {
    expect(precoAplicado(fisio, true)).toEqual({ cent: 19500, vinculo: true })
  })

  it('quem não é paga o cheio', () => {
    expect(precoAplicado(fisio, false)).toEqual({ cent: 23000, vinculo: false })
  })

  it('plano de preço único não anuncia vínculo, mesmo para quem tem', () => {
    // dizer "aplicamos o preço de cliente" num plano de preço único faz a
    // recepção procurar um desconto que não existe
    const mensal = { ...fisio, precoVinculadoCent: 73500, precoAvulsoCent: 73500 }
    expect(precoAplicado(mensal, true)).toEqual({ cent: 73500, vinculo: false })
  })
})

describe('como cobra', () => {
  const base = {
    parcelas: 1, precoVinculadoCent: 0, precoAvulsoCent: 0,
    frequenciaSemanal: null, sessoesNoPacote: null, validadeMeses: null,
  }

  it('diz a frequência quando o plano tem uma, no singular e no plural', () => {
    expect(comoCobra({ ...base, recorrencia: 'mensal', frequenciaSemanal: 2 }))
      .toBe('Todo mês · 2 horários')
    expect(comoCobra({ ...base, recorrencia: 'mensal', frequenciaSemanal: 1 }))
      .toBe('Todo mês · 1 horário')
  })

  it('conta as parcelas quando são mais de uma', () => {
    expect(comoCobra({
      ...base, recorrencia: 'trimestral', parcelas: 3, frequenciaSemanal: 2,
    })).toBe('3 parcelas · 2 horários')
  })

  it('o pacote fala em sessões e validade, que é o que ele é', () => {
    expect(comoCobra({
      ...base, recorrencia: 'pacote', sessoesNoPacote: 10, validadeMeses: 6,
    })).toBe('10 sessões · validade 6 meses')
  })

  it('pacote sem validade não inventa prazo', () => {
    expect(comoCobra({ ...base, recorrencia: 'pacote', sessoesNoPacote: 10 }))
      .toBe('10 sessões')
  })

  it('a avulsa não promete repetição nenhuma', () => {
    expect(comoCobra({ ...base, recorrencia: 'avulsa' })).toBe('Uma vez')
  })

  it('plano que se repete sem frequência definida não fica com sujeira no fim', () => {
    expect(comoCobra({ ...base, recorrencia: 'mensal' })).toBe('Todo mês')
  })
})
