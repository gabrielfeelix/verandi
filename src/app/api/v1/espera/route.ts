import { type NextRequest } from 'next/server'
import { entrarNaEspera } from '@/server/agenda/espera'
import { comChave, erro, erroDePedido, type Contexto } from '@/server/api/rota'
import { comIdempotencia, lerCorpo } from '@/server/api/idempotencia'
import { idObrigatorio, primeiro } from '@/core/api/pedido'

/**
 * Entrar na fila de um horário cheio.
 *
 * É o que transforma o fim da conversa em promessa. Hoje o bot chega em "esse
 * horário está cheio" e a pessoa vai procurar outro estúdio; com a fila, ele
 * chega em "te aviso se abrir", e quando abre sai o evento `vaga.aberta`.
 *
 * **Entrar na fila não reserva nada.** Quando a vaga abrir, a pessoa é chamada e
 * precisa marcar, como qualquer um. Reservar automaticamente seria o robô
 * decidindo, e criaria a pior conversa possível: "você foi marcada numa aula que
 * não pediu".
 *
 *   POST /api/v1/espera
 *   { "pessoaId": "...", "sessaoId": "..." }
 */
export const POST = comChave(async (req: NextRequest, ctx: Contexto) => {
  const corpo = await lerCorpo(req)
  if (!corpo) return erro(400, 'o corpo precisa ser um objeto JSON')

  const ruim = primeiro(
    idObrigatorio(corpo.json.pessoaId, 'pessoaId'),
    idObrigatorio(corpo.json.sessaoId, 'sessaoId'),
  )
  if (ruim) return erroDePedido(ruim)

  const pessoaId = corpo.json.pessoaId as string
  const sessaoId = corpo.json.sessaoId as string

  return comIdempotencia(req, ctx, 'POST /espera', corpo.bruto, async () => {
    const { data: pessoa } = await ctx.db.from('pessoa')
      .select('id').eq('id', pessoaId).eq('conta_id', ctx.contaId).maybeSingle()
    if (!pessoa) return { status: 404, corpo: { erro: 'esta pessoa não existe nesta conta' } }

    const r = await entrarNaEspera(ctx.db, ctx.contaId, sessaoId, pessoaId)

    if (!r.ok) {
      const motivo: Record<string, [number, string]> = {
        sessao_inexistente: [404, 'este horário não existe nesta conta'],
        ja_participa: [409, 'esta pessoa já está marcada neste horário'],
        /* fila em horário com vaga é a pessoa esperando um aviso que nunca vem */
        tem_vaga: [409, 'este horário tem vaga, é só marcar'],
        ja_esperava: [409, 'esta pessoa já está na fila deste horário'],
      }
      const [status, mensagem] = motivo[r.motivo]
      return { status, corpo: { erro: mensagem, motivo: r.motivo } }
    }

    return {
      status: 201,
      corpo: { esperaId: r.esperaId, pessoaId, sessaoId, posicao: r.posicao },
    }
  })
})
