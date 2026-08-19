import { describe, it, expect } from 'vitest'
import {
  dataPorExtenso, descricaoDoRecibo, documentoFormatado, emitenteCompleto,
  localDeEmissao, montarCorpo, numeroFormatado, podeCancelar, podeCorrigir,
  porExtenso, quemEmitiu,
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

describe('o documento no papel', () => {
  it('sai pontuado, como se lê', () => {
    expect(documentoFormatado('52998224725')).toBe('529.982.247-25')
    expect(documentoFormatado('12345678000190')).toBe('12.345.678/0001-90')
  })

  it('o que não é CPF nem CNPJ sai como veio, e não some', () => {
    // documento que o sistema não reconheceu ainda é o que a pessoa digitou
    expect(documentoFormatado('X-1234')).toBe('X-1234')
    expect(documentoFormatado(null)).toBeNull()
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

describe('a data por extenso', () => {
  it('escreve o mês por extenso, como um recibo escreve', () => {
    expect(dataPorExtenso('2026-08-19')).toBe('19 de agosto de 2026')
    expect(dataPorExtenso('2026-01-01')).toBe('1 de janeiro de 2026')
    expect(dataPorExtenso('2026-12-31')).toBe('31 de dezembro de 2026')
  })

  it('aceita a data com hora colada, que é como o corpo guarda a emissão', () => {
    expect(dataPorExtenso('2026-03-04T23:40:00.000Z')).toBe('4 de março de 2026')
  })

  /*
   * O dia 1 é o caso que quebra quando alguém troca isto por `new Date`: o
   * servidor em UTC lê `2026-08-01` como meia-noite em Londres, que é 31 de
   * julho às 21h no Brasil, e o recibo sai com o mês errado.
   */
  it('não anda para trás no dia 1', () => {
    expect(dataPorExtenso('2026-08-01')).toBe('1 de agosto de 2026')
  })

  it('data que não é data sai como veio, em vez de virar mês vazio', () => {
    expect(dataPorExtenso('sem data')).toBe('sem data')
  })
})

describe('o local de emissão', () => {
  it('lê a cidade quando o endereço termina em UF', () => {
    expect(localDeEmissao('Rua das Acácias, 204, Maringá, PR')).toBe('Maringá')
    expect(localDeEmissao('Av. Brasil, 2450, Apto 902, São Paulo, SP')).toBe('São Paulo')
  })

  /*
   * Cidade errada num recibo é pior que cidade ausente: a ausente é uma lacuna
   * que alguém percebe, e a errada é uma afirmação que ninguém confere.
   */
  it('não chuta quando o endereço não termina em UF', () => {
    expect(localDeEmissao('Rua das Acácias, 204')).toBeNull()
    expect(localDeEmissao('Rua das Acácias 204 Maringá Paraná')).toBeNull()
    expect(localDeEmissao('Maringá')).toBeNull()
    expect(localDeEmissao(null)).toBeNull()
  })
})

describe('quem emitiu, no papel', () => {
  it('devolve o nome de gente', () => {
    expect(quemEmitiu('Marina Toledo')).toBe('Marina Toledo')
  })

  /*
   * O corpo é congelado, e por meses ele guardou o e-mail de quem emitiu,
   * porque quem responde pelo negócio raramente está cadastrado como
   * profissional. Esse endereço pessoal ia impresso na via que fica com o
   * aluno. A emissão nova nunca mais grava e-mail; isto aqui é o que resolve o
   * que já está gravado.
   */
  it('nunca devolve e-mail, mesmo estando gravado no corpo antigo', () => {
    expect(quemEmitiu('dono@dev.local')).toBeNull()
    expect(quemEmitiu('contato@4yu.com.br')).toBeNull()
  })

  it('trata vazio e o antigo "Não informado" como ausência', () => {
    expect(quemEmitiu('')).toBeNull()
    expect(quemEmitiu('   ')).toBeNull()
    expect(quemEmitiu(null)).toBeNull()
    expect(quemEmitiu('Não informado')).toBeNull()
  })
})
