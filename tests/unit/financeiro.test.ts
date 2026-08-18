import { describe, it, expect } from 'vitest'
import {
  cobrancasPrevistas, competenciaCurta, competenciaDe, competenciaPorExtenso,
  diasDeAtraso, fimDaCompetencia, mesTrancado, proximaCompetencia,
  situacaoDaCobranca, valorDaParcela, vencimentoDa,
} from '@/core/financeiro/cobranca'
import {
  aReceber, carteira, clientes, descontoDeVinculo, emAtraso, estornosDoPeriodo,
  faturamentoPor, recebidoPorForma, type CobrancaDoPeriodo,
  type ContratoDoPeriodo, type PagamentoRecebido,
} from '@/core/financeiro/fechamento'

const mensal = {
  inicio: '2026-09-01',
  fim: null,
  recorrencia: 'mensal' as const,
  parcelas: 1,
  precoAplicadoCent: 73500,
  diaVencimento: 5,
  pausas: [],
}

describe('a competência', () => {
  it('é o dia 1 do mês, escrito assim', () => {
    expect(competenciaDe('2026-09-17')).toBe('2026-09-01')
  })

  it('vira o mês seguinte sem inventar o mês 13', () => {
    expect(proximaCompetencia('2026-12-01')).toBe('2027-01-01')
  })

  it('sabe o último dia do mês, inclusive o de fevereiro bissexto', () => {
    expect(fimDaCompetencia('2028-02-01')).toBe('2028-02-29')
    expect(fimDaCompetencia('2026-02-01')).toBe('2026-02-28')
  })

  it('fala como a recepção fala', () => {
    expect(competenciaPorExtenso('2026-09-01')).toBe('setembro de 2026')
    expect(competenciaCurta('2026-09-01')).toBe('set/26')
  })
})

describe('o vencimento', () => {
  it('cai no dia escolhido', () => {
    expect(vencimentoDa('2026-09-01', 5)).toBe('2026-09-05')
  })

  it('dia 31 num mês de trinta cai no dia 30, e não escorrega para outubro', () => {
    expect(vencimentoDa('2026-09-01', 31)).toBe('2026-09-30')
  })

  it('sem dia escolhido, vence no primeiro do mês, para aparecer em alguma lista', () => {
    expect(vencimentoDa('2026-09-01', null)).toBe('2026-09-01')
  })
})

describe('as cobranças que um contrato deve', () => {
  it('o mensal deve uma por mês até o horizonte', () => {
    const r = cobrancasPrevistas(mensal, '2026-11-01')
    expect(r.map((c) => c.competencia))
      .toEqual(['2026-09-01', '2026-10-01', '2026-11-01'])
    expect(r.every((c) => c.valorCent === 73500)).toBe(true)
  })

  it('a primeira não vence antes de o contrato começar', () => {
    // assinado no dia 20 com vencimento no dia 5: sem esta regra, o contrato
    // nasceria atrasado quinze dias
    const r = cobrancasPrevistas({ ...mensal, inicio: '2026-09-20' }, '2026-09-01')
    expect(r[0].vencimento).toBe('2026-09-20')
  })

  it('o trimestral em três parcelas cobra três meses, e depois recomeça', () => {
    const r = cobrancasPrevistas({
      ...mensal, recorrencia: 'trimestral', parcelas: 3,
      precoAplicadoCent: 198000, fim: null,
    }, '2027-01-01')
    expect(r.map((c) => c.valorCent)).toEqual([66000, 66000, 66000, 66000, 66000])
  })

  it('o trimestral à vista cobra tudo no primeiro mês do ciclo', () => {
    const r = cobrancasPrevistas({
      ...mensal, recorrencia: 'trimestral', parcelas: 1,
      precoAplicadoCent: 198000,
    }, '2027-01-01')
    expect(r.map((c) => [c.competencia, c.valorCent])).toEqual([
      ['2026-09-01', 198000],
      ['2026-12-01', 198000],
    ])
  })

  it('o pacote é uma cobrança só, e não uma assinatura', () => {
    const r = cobrancasPrevistas({
      ...mensal, recorrencia: 'pacote', precoAplicadoCent: 120000,
      fim: '2027-03-01',
    }, '2027-01-01')
    expect(r).toHaveLength(1)
    expect(r[0].valorCent).toBe(120000)
  })

  it('a avulsa vence no dia em que aconteceu', () => {
    const r = cobrancasPrevistas({
      ...mensal, recorrencia: 'avulsa', inicio: '2026-09-17',
      precoAplicadoCent: 12000, fim: '2026-09-17',
    }, '2026-10-01')
    expect(r).toEqual([
      { competencia: '2026-09-01', vencimento: '2026-09-17', valorCent: 12000 },
    ])
  })

  it('não passa do fim do contrato', () => {
    const r = cobrancasPrevistas({ ...mensal, fim: '2026-10-15' }, '2026-12-01')
    expect(r.map((c) => c.competencia)).toEqual(['2026-09-01', '2026-10-01'])
  })

  it('mês inteiro trancado não gera cobrança', () => {
    const r = cobrancasPrevistas({
      ...mensal, pausas: [{ inicio: '2026-09-25', fim: '2026-11-10' }],
    }, '2026-12-01')
    // outubro está inteiro dentro da licença; setembro e novembro não estão
    expect(r.map((c) => c.competencia))
      .toEqual(['2026-09-01', '2026-11-01', '2026-12-01'])
  })

  it('licença em aberto engole tudo daí para frente', () => {
    const r = cobrancasPrevistas({
      ...mensal, pausas: [{ inicio: '2026-09-01', fim: null }],
    }, '2026-12-01')
    expect(r).toEqual([])
  })
})

describe('o mês trancado', () => {
  it('precisa estar inteiro dentro da licença', () => {
    expect(mesTrancado('2026-10-01', [{ inicio: '2026-09-25', fim: '2026-11-10' }]))
      .toBe(true)
    expect(mesTrancado('2026-10-01', [{ inicio: '2026-10-05', fim: '2026-11-10' }]))
      .toBe(false)
  })
})

describe('a parcela', () => {
  it('divide exato quando divide', () => {
    expect(valorDaParcela(198000, 3)).toEqual([66000, 66000, 66000])
  })

  it('põe o centavo que sobra na primeira, e a soma bate com o contrato', () => {
    const p = valorDaParcela(10000, 3)
    expect(p).toEqual([3334, 3333, 3333])
    expect(p.reduce((s, x) => s + x, 0)).toBe(10000)
  })
})

describe('a situação de uma cobrança', () => {
  const venc = { vencimento: '2026-09-05' }

  it('vencida e em aberto é atrasada', () => {
    expect(situacaoDaCobranca({ ...venc, situacao: 'aberta' }, '2026-09-06'))
      .toBe('atrasada')
  })

  it('vencida e paga continua paga', () => {
    expect(situacaoDaCobranca({ ...venc, situacao: 'paga' }, '2026-10-01'))
      .toBe('paga')
  })

  it('cancelada não atrasa nunca', () => {
    expect(situacaoDaCobranca({ ...venc, situacao: 'cancelada' }, '2027-01-01'))
      .toBe('cancelada')
  })

  it('paga pela metade antes de vencer é parcial', () => {
    expect(situacaoDaCobranca({ ...venc, situacao: 'parcial' }, '2026-09-01'))
      .toBe('parcial')
  })

  it('conta os dias de atraso, e nunca conta negativo', () => {
    expect(diasDeAtraso('2026-09-05', '2026-09-20')).toBe(15)
    expect(diasDeAtraso('2026-09-05', '2026-09-01')).toBe(0)
  })
})

const pagamentos: PagamentoRecebido[] = [
  { valorCent: 73500, forma: 'pix', recebidoEm: '2026-09-05', servicoNome: 'Pilates', planoNome: 'Mensal 2x' },
  { valorCent: 30000, forma: 'dinheiro', recebidoEm: '2026-09-05', servicoNome: 'Fisioterapia', planoNome: 'Sessão' },
  { valorCent: 43500, forma: 'pix', recebidoEm: '2026-09-06', servicoNome: 'Pilates', planoNome: 'Mensal 2x' },
]

describe('o fechamento', () => {
  it('soma o que entrou por forma de pagamento, do maior para o menor', () => {
    const r = recebidoPorForma(pagamentos)
    expect(r.totalCent).toBe(147000)
    expect(r.porForma[0]).toEqual({
      forma: 'pix', rotulo: 'Pix', totalCent: 117000, quantidade: 2,
    })
  })

  it('a receber conta o que falta, e separa o vencido', () => {
    const cobrancas: CobrancaDoPeriodo[] = [
      linha({ vencimento: '2026-09-05', valorCent: 73500, valorPagoCent: 30000, situacao: 'parcial' }),
      linha({ vencimento: '2026-09-25', valorCent: 73500, valorPagoCent: 0, situacao: 'aberta' }),
      linha({ vencimento: '2026-09-01', valorCent: 73500, valorPagoCent: 73500, situacao: 'paga' }),
      linha({ vencimento: '2026-09-01', valorCent: 73500, valorPagoCent: 0, situacao: 'cancelada' }),
    ]
    expect(aReceber(cobrancas, '2026-09-10')).toEqual({
      totalCent: 117000, aVencerCent: 73500, vencidoCent: 43500,
    })
  })

  it('o atraso é por pessoa, com o mais velho na frente', () => {
    const cobrancas: CobrancaDoPeriodo[] = [
      linha({ pessoaId: 'a', pessoaNome: 'Marina', vencimento: '2026-08-05', valorCent: 73500, situacao: 'aberta' }),
      linha({ pessoaId: 'a', pessoaNome: 'Marina', vencimento: '2026-09-05', valorCent: 73500, situacao: 'aberta' }),
      linha({ pessoaId: 'b', pessoaNome: 'Joana', vencimento: '2026-09-05', valorCent: 30000, situacao: 'aberta' }),
    ]
    const r = emAtraso(cobrancas, '2026-09-20')
    expect(r).toHaveLength(2)
    expect(r[0]).toMatchObject({
      pessoaNome: 'Marina', cobrancas: 2, totalCent: 147000, diasDoMaisVelho: 46,
    })
    expect(r[1].pessoaNome).toBe('Joana')
  })

  it('o faturamento é sobre o que entrou, por modalidade', () => {
    expect(faturamentoPor(pagamentos, 'servicoNome')).toEqual([
      { nome: 'Pilates', totalCent: 117000, quantidade: 2 },
      { nome: 'Fisioterapia', totalCent: 30000, quantidade: 1 },
    ])
  })

  it('a carteira conta novos, encerrados e o recorrente sem os trancados', () => {
    const contratos: ContratoDoPeriodo[] = [
      contrato({ inicio: '2026-09-03', status: 'ativo', precoAplicadoCent: 73500 }),
      contrato({ inicio: '2026-01-10', status: 'pausado', precoAplicadoCent: 73500 }),
      contrato({ inicio: '2025-05-01', status: 'encerrado', fim: '2026-09-20', precoAplicadoCent: 45000 }),
    ]
    expect(carteira(contratos, '2026-09-01', '2026-09-30')).toEqual({
      novos: 1, encerrados: 1, emVigor: 2, recorrenteCent: 73500,
    })
  })

  it('os estornos somam o que voltou atrás, com o mais recente na frente', () => {
    const r = estornosDoPeriodo([
      { valorCent: 30000, estornadoEm: '2026-09-03T10:00:00Z', motivo: 'em dobro', pessoaNome: 'Marina' },
      { valorCent: 73500, estornadoEm: '2026-09-20T10:00:00Z', motivo: 'cheque devolvido', pessoaNome: 'Joana' },
    ])
    expect(r).toMatchObject({ quantidade: 2, totalCent: 103500 })
    expect(r.linhas[0].pessoaNome).toBe('Joana')
  })

  it('os clientes são contados por ficha, e quem pediu exclusão sai das três contas', () => {
    const r = clientes([
      { ativo: true, criadoEm: '2026-09-10T10:00:00Z', anonimizada: false },
      { ativo: true, criadoEm: '2025-01-10T10:00:00Z', anonimizada: false },
      { ativo: false, criadoEm: '2024-05-10T10:00:00Z', anonimizada: false },
      // anonimizada: a ficha existe por causa do histórico, e não descreve
      // mais ninguém
      { ativo: true, criadoEm: '2026-09-11T10:00:00Z', anonimizada: true },
    ], '2026-09-01', '2026-09-30')
    expect(r).toEqual({ ativos: 2, inativos: 1, novos: 1 })
  })

  it('o desconto de vínculo soma a diferença de quem o usou', () => {
    const contratos: ContratoDoPeriodo[] = [
      contrato({ vinculoUsado: true, precoAvulsoCent: 23000, precoVinculadoCent: 19500 }),
      contrato({ vinculoUsado: false, precoAvulsoCent: 23000, precoVinculadoCent: 19500 }),
    ]
    expect(descontoDeVinculo(contratos)).toEqual({ contratos: 1, totalCent: 3500 })
  })
})

function linha(x: Partial<CobrancaDoPeriodo>): CobrancaDoPeriodo {
  return {
    id: 'c', pessoaId: 'p', pessoaNome: 'Alguém', telefone: null,
    competencia: '2026-09-01', vencimento: '2026-09-05',
    valorCent: 0, valorPagoCent: 0, situacao: 'aberta', ...x,
  }
}

function contrato(x: Partial<ContratoDoPeriodo>): ContratoDoPeriodo {
  return {
    inicio: '2026-09-01', fim: null, status: 'ativo', precoAplicadoCent: 0,
    vinculoUsado: false, precoAvulsoCent: 0, precoVinculadoCent: 0, ...x,
  }
}
