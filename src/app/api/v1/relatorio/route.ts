import { NextResponse, type NextRequest } from 'next/server'
import { dataValida, primeiro } from '@/core/api/pedido'
import { resumoParaApi } from '@/server/relatorio/consultas'
import { comChave, erroDePedido, type Contexto } from '@/server/api/rota'

/** Um ano e pouco: o relatório do outro lado tem o atalho "12 meses". */
const JANELA_MAXIMA_DIAS = 400

/**
 * O resumo das aulas de um período, para o relatório do AutoFluxos.
 *
 * Presença, falta, reposição, aula experimental que virou matrícula, matrícula
 * nova e quem saiu: o que o AutoFluxos não tem como saber sozinho e não pode
 * ler daqui, porque os dois produtos dividem o banco e nenhum lê o schema do
 * outro. As definições estão em `core/relatorio/resumo-da-api.ts`.
 *
 * Só números, e nenhum nome: o relatório conta, não lista.
 *
 *   GET /api/v1/relatorio?de=2026-10-01&ate=2026-10-31
 */
export const GET = comChave(async (req: NextRequest, ctx: Contexto) => {
  const p = req.nextUrl.searchParams
  const de = p.get('de')
  const ate = p.get('ate')
  const ruim = primeiro(dataValida(de, 'de'), dataValida(ate, 'ate'))
  if (ruim) return erroDePedido(ruim)
  if (ate! < de!) return erroDePedido({ campo: 'ate', mensagem: 'ate não pode ser antes de de' })
  if ((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 864e5 > JANELA_MAXIMA_DIAS) {
    return erroDePedido({ campo: 'ate', mensagem: `o intervalo não pode passar de ${JANELA_MAXIMA_DIAS} dias` })
  }

  const { data: conta } = await ctx.db.from('conta').select('fuso').eq('id', ctx.contaId).maybeSingle()
  const fuso = (conta as { fuso: string | null } | null)?.fuso ?? 'America/Sao_Paulo'

  const resumo = await resumoParaApi(ctx.db, ctx.contaId, de!, ate!, fuso)
  return NextResponse.json({ de, ate, ...resumo })
})
