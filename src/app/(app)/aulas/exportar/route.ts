import { clienteServidor, exigirConta } from '@/server/conta'
import { hojeEm } from '@/server/agenda/fuso'
import { aulasDoPeriodo } from '@/server/relatorio/consultas'
import { competenciaDe } from '@/core/financeiro/cobranca'

/**
 * As aulas do período em planilha.
 *
 * "Planilha" é a palavra que o documento usa no item 7, e o motivo é concreto:
 * quem paga o profissional não abre o sistema. Os números são os mesmos da
 * tela, vindos da mesma função: planilha que discorda da tela é a razão de
 * ninguém confiar em nenhuma das duas.
 */
function celula(v: string | number | null | undefined): string {
  const s = String(v ?? '')
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function GET(pedido: Request) {
  const conta = await exigirConta()
  if (conta.papel !== 'dono' && conta.papel !== 'suporte') {
    return new Response('sem acesso', { status: 403 })
  }

  const db = await clienteServidor()
  const hoje = hojeEm(conta.fuso)
  const url = new URL(pedido.url)
  const de = url.searchParams.get('de') || competenciaDe(hoje)
  const ate = url.searchParams.get('ate') || hoje

  const r = await aulasDoPeriodo(db, conta.contaId, de, ate, conta.fuso)

  const linhas: Array<Array<string | number>> = [
    ['Aulas por profissional', `de ${de} a ${ate}`],
    [],
    ['Profissional', 'Aulas aplicadas', 'Presenças', 'Com gente',
     'Sem ninguém', 'Sem chamada', 'Canceladas', 'Por dia fechado', 'Ainda por dar'],
    ...r.linhas.map((l) => [
      l.profissionalNome, l.aplicadas, l.atendimentos, l.comPresenca,
      l.semNinguem, l.semChamada, l.canceladas, l.porFeriado, l.aindaPorDar,
    ]),
    [],
    ['Total', r.total.aplicadas, r.total.atendimentos, '', '',
     r.total.semChamada, r.total.canceladas, r.total.porFeriado, r.total.aindaPorDar],
    [],
    ['Aula aplicada é a que já aconteceu e não foi cancelada, mesmo sem ninguém presente.'],
  ]

  // o BOM na frente é o que faz o Excel abrir acentuação sem perguntar nada
  const csv = '﻿' + linhas
    .map((l) => l.map(celula).join(';')).join('\r\n')

  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="aulas-${de}-a-${ate}.csv"`,
    },
  })
}
