import { clienteServidor, exigirConta } from '@/server/conta'
import { listarPendencias } from '@/server/pendencias/consultas'

/**
 * A lista de pendências em planilha.
 *
 * Serve para uma coisa concreta: dividir a fila entre duas pessoas na
 * recepção. Sem isso, "quem liga para quem" volta a ser combinado por
 * mensagem — que é exatamente o buraco que esta tela existe para tapar.
 */
function celula(v: string | number | null | undefined): string {
  const s = String(v ?? '')
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function GET() {
  const conta = await exigirConta()
  const db = await clienteServidor()
  const grupos = await listarPendencias(db, conta.contaId, conta.fuso)

  const linhas = grupos.flatMap((g) =>
    g.itens.map((p) => [g.titulo, p.titulo, p.detalhe, p.diasEmAberto ?? '']),
  )

  const csv = '﻿' + [
    ['Grupo', 'Item', 'Detalhe', 'Dias em aberto'],
    ...linhas,
  ].map((l) => l.map(celula).join(';')).join('\r\n')

  const hoje = new Date().toISOString().slice(0, 10)
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="pendencias-${hoje}.csv"`,
    },
  })
}
