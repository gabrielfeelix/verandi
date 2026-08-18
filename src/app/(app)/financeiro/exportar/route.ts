import { clienteServidor, exigirConta } from '@/server/conta'
import { hojeEm } from '@/server/agenda/fuso'
import { materialDoFechamento } from '@/server/financeiro/consultas'
import {
  aReceber, carteira, clientes, descontoDeVinculo, emAtraso, estornosDoPeriodo,
  faturamentoPor, recebidoPorForma,
} from '@/core/financeiro/fechamento'
import { competenciaDe } from '@/core/financeiro/cobranca'

/**
 * O fechamento em planilha.
 *
 * Serve para uma coisa concreta: mandar o mês para o contador, e conferir o
 * caixa fora da tela. As somas são as mesmas de `core/financeiro`, e não uma
 * segunda versão delas: planilha que discorda da tela é a razão de ninguém
 * confiar em nenhuma das duas.
 */
function celula(v: string | number | null | undefined): string {
  const s = String(v ?? '')
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const reais = (cent: number) => (cent / 100).toFixed(2).replace('.', ',')

export async function GET(pedido: Request) {
  const conta = await exigirConta()
  if (conta.papel === 'profissional') {
    return new Response('sem acesso', { status: 403 })
  }

  const db = await clienteServidor()
  const hoje = hojeEm(conta.fuso)
  const url = new URL(pedido.url)
  const de = url.searchParams.get('de') || competenciaDe(hoje)
  const ate = url.searchParams.get('ate') || hoje

  const m = await materialDoFechamento(db, conta.contaId, de, ate, hoje)
  const recebido = recebidoPorForma(m.pagamentos)
  const receber = aReceber(m.cobrancas, hoje)
  const vencido = aReceber(m.atrasadas, hoje)
  const atraso = emAtraso(m.atrasadas, hoje)
  const cart = carteira(m.contratos, de, ate)
  const vinculo = descontoDeVinculo(m.contratos)
  const estornos = estornosDoPeriodo(m.estornos)
  const gente = clientes(m.pessoas, de, ate)

  const linhas: Array<Array<string | number>> = [
    ['Fechamento', `de ${de} a ${ate}`],
    [],
    ['Entrou no período', reais(recebido.totalCent)],
    ...recebido.porForma.map((f) => [`  ${f.rotulo}`, reais(f.totalCent), f.quantidade]),
    [],
    ['Ainda vai vencer', reais(receber.aVencerCent)],
    ['Vencido e não pago, hoje', reais(vencido.vencidoCent)],
    ['Previsto para o mês seguinte', reais(m.previstoCent)],
    [],
    ['Em atraso, por pessoa'],
    ['Pessoa', 'Telefone', 'Cobranças', 'Dias', 'Total'],
    ...atraso.map((a) => [
      a.pessoaNome, a.telefone ?? '', a.cobrancas, a.diasDoMaisVelho,
      reais(a.totalCent),
    ]),
    [],
    ['Faturamento por modalidade'],
    ...faturamentoPor(m.pagamentos, 'servicoNome')
      .map((f) => [f.nome, reais(f.totalCent), f.quantidade]),
    [],
    ['Faturamento por plano'],
    ...faturamentoPor(m.pagamentos, 'planoNome')
      .map((f) => [f.nome, reais(f.totalCent), f.quantidade]),
    [],
    ['Estornos no período', reais(estornos.totalCent), estornos.quantidade],
    ['Pessoa', 'Estornado em', 'Motivo', 'Valor'],
    ...estornos.linhas.map((e) => [
      e.pessoaNome, e.estornadoEm.slice(0, 10), e.motivo ?? '', reais(e.valorCent),
    ]),
    [],
    ['Clientes'],
    ['Ativos', gente.ativos],
    ['Inativos', gente.inativos],
    ['Novos no período', gente.novos],
    [],
    ['Carteira'],
    ['Contratos novos no período', cart.novos],
    ['Encerrados no período', cart.encerrados],
    ['Em vigor', cart.emVigor],
    ['Recorrente', reais(cart.recorrenteCent)],
    [],
    ['Desconto de vínculo', reais(vinculo.totalCent), `${vinculo.contratos} contratos`],
  ]

  // o BOM na frente é o que faz o Excel abrir acentuação sem perguntar nada
  const csv = '﻿' + linhas
    .map((l) => l.map(celula).join(';')).join('\r\n')

  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="financeiro-${de}-a-${ate}.csv"`,
    },
  })
}
