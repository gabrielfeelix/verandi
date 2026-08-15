import { NextResponse, type NextRequest } from 'next/server'
import { sairDaEspera } from '@/server/agenda/espera'
import { comChave, erro, erroDePedido, type Contexto } from '@/server/api/rota'
import { idObrigatorio } from '@/core/api/pedido'

/**
 * Sair da fila.
 *
 * Acontece o tempo todo na conversa real: a pessoa entra na espera de terça,
 * consegue marcar na quinta, e não quer mais ser avisada. Sem esta rota, o
 * estúdio liga oferecendo uma vaga que ela já não precisa, e a promessa vira
 * incômodo.
 *
 * Como no resto da API, não apaga: marca a saída. A fila é histórico de demanda,
 * e "quantas pessoas ficaram esperando a aula das sete" é a pergunta que decide
 * se vale abrir uma turma nova.
 *
 *   DELETE /api/v1/espera/<uuid>
 */
export const DELETE = comChave<{ id: string }>(async (
  req: NextRequest,
  ctx: Contexto,
  params,
) => {
  const ruim = idObrigatorio(params.id, 'id')
  if (ruim) return erroDePedido(ruim)

  const saiu = await sairDaEspera(ctx.db, ctx.contaId, params.id)

  /*
   * Já ter saído devolve 200, e não 404: a reentrega é caminho normal, e quem
   * chama queria exatamente o estado em que a coisa está.
   */
  if (!saiu) {
    const { data } = await ctx.db.from('espera')
      .select('id').eq('id', params.id).eq('conta_id', ctx.contaId).maybeSingle()
    if (!data) return erro(404, 'esta espera não existe nesta conta')
    return NextResponse.json({ esperaId: params.id, jaEstavaAssim: true })
  }

  return NextResponse.json({ esperaId: params.id, jaEstavaAssim: false })
})
