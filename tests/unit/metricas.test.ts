import { describe, it, expect } from 'vitest'
import {
  resumoDaPessoa, resumoDeCobrancas, resumoDeRecibos, variacao,
} from '@/core/financeiro/metricas'

const cobranca = (
  valorCent: number, valorPagoCent: number, situacao: string, vencimento = '2026-08-05',
) => ({ valorCent, valorPagoCent, situacao, vencimento })

describe('o resumo de cobranças', () => {
  it('soma o cobrado, o pago e o que falta', () => {
    const r = resumoDeCobrancas([
      cobranca(70000, 70000, 'paga'),
      cobranca(70000, 30000, 'parcial'),
      cobranca(40000, 0, 'aberta'),
    ])
    expect(r.totalCent).toBe(180000)
    expect(r.pagoCent).toBe(100000)
    expect(r.abertoCent).toBe(80000)
    expect(r.quantidadeAberta).toBe(2)
  })

  /*
   * Somar cancelada no total faria o fechamento prometer dinheiro que ninguém
   * combinou de pagar. Ela existe, tem motivo à vista, e alguém vai perguntar
   * por ela: por isso continua contada à parte.
   */
  it('a cancelada sai da soma e continua contada', () => {
    const r = resumoDeCobrancas([
      cobranca(70000, 0, 'aberta'),
      cobranca(50000, 0, 'cancelada'),
    ])
    expect(r.totalCent).toBe(70000)
    expect(r.abertoCent).toBe(70000)
    expect(r.canceladasCent).toBe(50000)
    expect(r.quantidadeCancelada).toBe(1)
    expect(r.quantidade).toBe(2)
  })

  /*
   * Quem pagou a mais fez um acerto no balcão que o sistema não conhece.
   * Deixar o aberto ficar negativo faria a soma da lista inteira encolher por
   * causa de uma linha, e o total pararia de bater com a conta de ninguém.
   */
  it('quem pagou a mais não vira crédito nem aberto negativo', () => {
    const r = resumoDeCobrancas([cobranca(70000, 75000, 'paga')])
    expect(r.abertoCent).toBe(0)
    expect(r.pagoCent).toBe(70000)
  })

  it('o ticket ignora as canceladas', () => {
    const r = resumoDeCobrancas([
      cobranca(60000, 0, 'aberta'),
      cobranca(40000, 0, 'aberta'),
      cobranca(100000, 0, 'cancelada'),
    ])
    expect(r.ticketCent).toBe(50000)
  })

  it('lista vazia dá zero em tudo, e não NaN', () => {
    const r = resumoDeCobrancas([])
    expect(r.ticketCent).toBe(0)
    expect(r.totalCent).toBe(0)
    expect(r.quantidade).toBe(0)
  })
})

describe('o resumo de recibos', () => {
  it('conta o cancelado e não soma o valor dele', () => {
    const r = resumoDeRecibos([
      { valorCent: 30000, status: 'valido' },
      { valorCent: 40000, status: 'cancelado' },
      { valorCent: 50000, status: 'substituido' },
    ])
    expect(r.quantidade).toBe(3)
    expect(r.validos).toBe(1)
    expect(r.cancelados).toBe(1)
    expect(r.substituidos).toBe(1)
    expect(r.validoCent).toBe(30000)
  })
})

describe('o retrato financeiro de uma pessoa', () => {
  const hoje = '2026-08-19'

  it('soma o que entrou e separa o vencido do que ainda vai vencer', () => {
    const r = resumoDaPessoa(
      [
        cobranca(70000, 70000, 'paga', '2026-07-05'),
        cobranca(70000, 20000, 'parcial', '2026-08-05'),
        cobranca(70000, 0, 'aberta', '2026-09-05'),
      ],
      [
        { valorCent: 70000, recebidoEm: '2026-07-04', forma: 'pix', estornado: false },
        { valorCent: 20000, recebidoEm: '2026-08-06', forma: 'pix', estornado: false },
      ],
      hoje,
    )
    expect(r.pagoCent).toBe(90000)
    expect(r.atrasadoCent).toBe(50000)
    expect(r.quantidadeAtrasada).toBe(1)
    expect(r.abertoCent).toBe(120000)
    expect(r.primeiroPagamento).toBe('2026-07-04')
    expect(r.ultimoPagamento).toBe('2026-08-06')
    expect(r.formaMaisUsada).toBe('pix')
  })

  /*
   * O estornado é uma linha que existe para explicar por que o dinheiro saiu,
   * e não uma vez que a pessoa pagou. Contá-lo faria a ficha dizer que alguém
   * é bom pagador por causa de um pagamento que foi devolvido.
   */
  it('o estornado não conta nem no total nem na forma preferida', () => {
    const r = resumoDaPessoa(
      [],
      [
        { valorCent: 70000, recebidoEm: '2026-08-01', forma: 'credito', estornado: true },
        { valorCent: 30000, recebidoEm: '2026-08-02', forma: 'pix', estornado: false },
      ],
      hoje,
    )
    expect(r.pagoCent).toBe(30000)
    expect(r.formaMaisUsada).toBe('pix')
    expect(r.primeiroPagamento).toBe('2026-08-02')
  })

  it('a cancelada não entra no que a pessoa deve', () => {
    const r = resumoDaPessoa(
      [cobranca(70000, 0, 'cancelada', '2026-06-05')], [], hoje,
    )
    expect(r.abertoCent).toBe(0)
    expect(r.atrasadoCent).toBe(0)
  })

  it('quem nunca pagou não inventa data nem forma', () => {
    const r = resumoDaPessoa([], [], hoje)
    expect(r.pagoCent).toBe(0)
    expect(r.primeiroPagamento).toBeNull()
    expect(r.ultimoPagamento).toBeNull()
    expect(r.formaMaisUsada).toBeNull()
  })
})

describe('a variação entre dois períodos', () => {
  it('é a diferença em pontos percentuais inteiros', () => {
    expect(variacao(12000, 10000)).toBe(20)
    expect(variacao(8000, 10000)).toBe(-20)
    expect(variacao(10000, 10000)).toBe(0)
  })

  /*
   * Sair de zero para R$ 4.000 não é "aumento de infinito por cento", é o
   * primeiro mês. Mostrar um número ali seria inventar uma tendência a partir
   * de um ponto só.
   */
  it('não compara com o que não existia', () => {
    expect(variacao(400000, 0)).toBeNull()
    expect(variacao(0, 0)).toBeNull()
  })
})
