import { NextResponse, type NextRequest } from 'next/server'
import { comChave, erro, erroDePedido, type Contexto } from '@/server/api/rota'
import { idObrigatorio } from '@/core/api/pedido'
import { avisar } from '@/server/webhook/eventos'
import { avisarQuemEspera } from '@/server/agenda/espera'

/**
 * Desmarcar, que é diferente de apagar.
 *
 * O verbo é `DELETE` porque é o que quem chama espera escrever ("tire essa
 * marcação"), mas do lado de cá **nada é apagado**: a participação recebe o
 * status `falta_avisada`, que é exatamente o que a recepção grava quando alguém
 * liga dizendo que não vem.
 *
 * Isso não é sutileza de implementação, é a diferença entre a pessoa ter ou não
 * ter a aula de volta. `falta_avisada` faz três coisas ao mesmo tempo:
 *
 * 1. **libera a vaga** para quem estiver esperando, porque quem avisou não ocupa;
 * 2. **gera o crédito de reposição**, se a conta configurou que avisar antes dá
 *    direito a repor. Apagar a linha destruiria o crédito junto;
 * 3. **mantém o histórico**, que é o que responde "ela cancelou três vezes esse
 *    mês" quando alguém precisar dessa conversa.
 *
 * Apagar de verdade continua existindo na tela, e não na API: é o que se faz
 * quando a marcação foi engano, e engano quem reconhece é gente.
 *
 * **Só o futuro.** Desmarcar uma aula que já aconteceu seria reescrever a
 * chamada que a professora fez, pelo WhatsApp, depois do fato.
 *
 *   DELETE /api/v1/participacoes/<uuid>
 */
export const DELETE = comChave<{ id: string }>(async (
  req: NextRequest,
  ctx: Contexto,
  params,
) => {
  const ruim = idObrigatorio(params.id, 'id')
  if (ruim) return erroDePedido(ruim)

  const { data: p } = await ctx.db
    .from('participacao')
    .select('id, status, sessao_id, sessao:sessao_id(inicio, status)')
    .eq('id', params.id).eq('conta_id', ctx.contaId)
    .maybeSingle()

  if (!p) return erro(404, 'esta marcação não existe nesta conta')

  const sessao = p.sessao as unknown as { inicio: string; status: string } | null
  if (!sessao) return erro(404, 'esta marcação não existe nesta conta')
  const sessaoDaLinha = p.sessao_id

  if (Date.parse(sessao.inicio) < Date.now()) {
    return erro(409, 'este horário já passou, e a chamada dele é de quem estava na sala')
  }

  /*
   * Já desmarcada devolve 200, e não erro.
   *
   * A reentrega é o caminho normal aqui: o bot manda, a rede cai, o WhatsApp
   * repete. Responder 409 na segunda faria a esteira tratar como falha algo que
   * está exatamente do jeito que ela queria.
   */
  if (p.status === 'falta_avisada') {
    return NextResponse.json({
      participacaoId: p.id, status: p.status, jaEstavaAssim: true,
    })
  }

  const { error } = await ctx.db.from('participacao').update({
    status: 'falta_avisada',
    registrado_por_usuario_id: null,
    registrado_por_origem: 'bot',
    registrado_em: new Date().toISOString(),
  }).eq('id', params.id).eq('conta_id', ctx.contaId)
  if (error) throw error

  /*
   * A vaga abriu, e alguém do outro lado pode estar esperando por ela. O evento
   * sai mesmo quando quem desmarcou foi o próprio bot: a integração que recebe
   * pode não ser a mesma que chamou, e é ela que mantém a lista de espera.
   */
  await avisar(ctx.db, ctx.contaId, 'participacao.cancelada', {
    participacaoId: params.id, sessaoId: sessaoDaLinha,
  })

  // e quem estava na fila deste horário é chamado, na ordem de chegada
  await avisarQuemEspera(ctx.db, ctx.contaId, sessaoDaLinha)

  return NextResponse.json({
    participacaoId: p.id,
    status: 'falta_avisada',
    jaEstavaAssim: false,
  })
})
