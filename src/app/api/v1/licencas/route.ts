import { type NextRequest } from 'next/server'
import { comChave, erro, erroDePedido, type Contexto } from '@/server/api/rota'
import { comIdempotencia, lerCorpo } from '@/server/api/idempotencia'
import { idObrigatorio } from '@/core/api/pedido'
import {
  encerrarLicenca, licencaDaPessoa, marcarVoltouSemReagendar,
} from '@/server/licencas/licencas'

/**
 * "Voltei de licença", dito pelo WhatsApp.
 *
 * O bot pergunta se a pessoa quer reagendar e conta o resultado aqui:
 *
 * - `reagendou: true`: ela marcou aula na conversa. A licença fecha, e a volta
 *   fica registrada como feita pelo bot.
 * - `reagendou: false`: voltou e não quis marcar agora. A licença **continua
 *   aberta**, marcada, e sobe para o topo de Pendências para alguém ligar. É o
 *   que o estúdio pediu: o bot não decide a volta sozinho quando a conversa
 *   termina sem aula marcada.
 *
 * Pessoa sem licença aberta devolve 200 com `tinhaLicenca: false`: a pessoa diz
 * que voltou mesmo quando ninguém registrou a saída, e isso não é erro do bot.
 *
 *   POST /api/v1/licencas   { "pessoaId": "<uuid>", "reagendou": true }
 */
export const POST = comChave(async (req: NextRequest, ctx: Contexto) => {
  const corpo = await lerCorpo(req)
  if (!corpo) return erro(400, 'o corpo precisa ser um objeto JSON')

  const ruim = idObrigatorio(corpo.json.pessoaId, 'pessoaId')
  if (ruim) return erroDePedido(ruim)
  if (typeof corpo.json.reagendou !== 'boolean') {
    return erro(400, 'reagendou precisa ser true ou false')
  }

  const pessoaId = corpo.json.pessoaId as string
  const reagendou = corpo.json.reagendou

  return comIdempotencia(req, ctx, 'POST /licencas', corpo.bruto, async () => {
    const { data: pessoa } = await ctx.db.from('pessoa')
      .select('id').eq('id', pessoaId).eq('conta_id', ctx.contaId).maybeSingle()
    if (!pessoa) return { status: 404, corpo: { erro: 'esta pessoa não existe nesta conta' } }

    const aberta = await licencaDaPessoa(ctx.db, ctx.contaId, pessoaId)
    if (!aberta) {
      return { status: 200, corpo: { pessoaId, tinhaLicenca: false, licencaAberta: false } }
    }

    if (reagendou) {
      await encerrarLicenca(ctx.db, ctx.contaId, [pessoaId], 'bot')
      return { status: 200, corpo: { pessoaId, tinhaLicenca: true, licencaAberta: false } }
    }

    await marcarVoltouSemReagendar(ctx.db, ctx.contaId, pessoaId)
    return { status: 200, corpo: { pessoaId, tinhaLicenca: true, licencaAberta: true } }
  })
})
