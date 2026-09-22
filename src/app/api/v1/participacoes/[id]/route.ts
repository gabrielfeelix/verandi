import { NextResponse, type NextRequest } from 'next/server'
import { comChave, erro, erroDePedido, type Contexto } from '@/server/api/rota'
import { idObrigatorio } from '@/core/api/pedido'
import { avisar } from '@/server/webhook/eventos'
import { avisarQuemEspera } from '@/server/agenda/espera'
import { avaliarAviso, avisoDeForaDoPrazo, prazoPorExtenso } from '@/core/agenda/cancelamento'
import { localDe } from '@/server/agenda/fuso'

/**
 * Uma marcação, e o que acontece se ela for cancelada agora.
 *
 * Existe para a pergunta que vem **antes** do `DELETE`: a pessoa escolheu a
 * aula no menu do bot, e agora é preciso saber se cancelar neste instante ainda
 * dá direito a repor. A ficha da pessoa já responde isso para a lista inteira,
 * mas responder por lista obriga quem consome a casar duas listas por posição —
 * e no dia em que uma delas vier filtrada, a resposta passa a ser a da aula do
 * vizinho, calada. Aqui o id é o pedido, então não há o que desalinhar.
 *
 * **O veredito vale para o instante da consulta.** Ele envelhece: uma aula que
 * às 13h ainda podia ser cancelada com crédito já não pode às 14h. Quem grava a
 * decisão é o `DELETE`, que refaz a conta no momento do aviso — o que sai daqui
 * serve para escolher a frase, não para valer como registro.
 *
 * `avisoParaConfirmar` vem pronto e é `null` quando está dentro do prazo: a
 * frase que o estúdio pediu, montada num lugar só, para cada integração não
 * inventar a sua.
 *
 *   GET /api/v1/participacoes/<uuid>
 */
export const GET = comChave<{ id: string }>(async (
  req: NextRequest,
  ctx: Contexto,
  params,
) => {
  const ruim = idObrigatorio(params.id, 'id')
  if (ruim) return erroDePedido(ruim)

  const { data: p } = await ctx.db
    .from('participacao')
    .select(`
      id, status, origem, sessao_id,
      sessao:sessao_id(inicio, servico:servico_id(id, nome)),
      pessoa:pessoa_id(id, nome)
    `)
    .eq('id', params.id).eq('conta_id', ctx.contaId)
    .maybeSingle()

  if (!p) return erro(404, 'esta marcação não existe nesta conta')

  const sessao = p.sessao as unknown as
    { inicio: string; servico: { id: string; nome: string } | null } | null
  if (!sessao) return erro(404, 'esta marcação não existe nesta conta')

  const { data: conta } = await ctx.db
    .from('conta')
    .select('fuso, minutos_minimos_cancelamento')
    .eq('id', ctx.contaId)
    .maybeSingle()

  const c = conta as
    { fuso: string | null; minutos_minimos_cancelamento: number } | null
  const fuso = c?.fuso ?? 'America/Sao_Paulo'
  const minutosExigidos = c?.minutos_minimos_cancelamento ?? 0

  const { data, hora } = localDe(sessao.inicio, fuso)
  const veredito = avaliarAviso(new Date(), new Date(sessao.inicio), minutosExigidos)
  const pessoa = p.pessoa as unknown as { id: string; nome: string } | null

  /*
   * Aula que já passou não é cancelável, e dizer só `podeReporSeCancelarAgora:
   * false` esconderia o motivo: quem lê acharia que foi o prazo, e ofereceria
   * "quer cancelar mesmo assim?" para uma aula que o `DELETE` vai recusar com
   * 409. São duas respostas diferentes e o campo separa as duas.
   */
  const jaPassou = Date.parse(sessao.inicio) < Date.now()

  return NextResponse.json({
    participacaoId: p.id,
    pessoaId: pessoa?.id ?? null,
    nome: pessoa?.nome ?? null,
    sessaoId: p.sessao_id,
    data,
    hora,
    inicio: sessao.inicio,
    servico: sessao.servico?.nome ?? 'sem registro',
    /*
     * O id do serviço, e não só o nome, pelo mesmo motivo da ficha da pessoa
     * (`ae5bf27`): quem vai procurar outro horário para esta mesma aula precisa
     * filtrar a disponibilidade, e a disponibilidade filtra por id. Sem ele, o
     * bot de reposição da MGM ou oferece horário de qualquer modalidade, ou
     * chama uma pessoa para fazer a conta à mão.
     */
    servicoId: sessao.servico?.id ?? null,
    origem: p.origem,
    status: p.status,
    jaPassou,
    podeCancelar: !jaPassou && p.status !== 'falta_avisada' && p.status !== 'falta',
    podeReporSeCancelarAgora: veredito.temCredito,
    minutosAteAula: Math.round(veredito.minutosDeAntecedencia),
    regraDeCancelamento: {
      minutosMinimos: minutosExigidos,
      porExtenso: prazoPorExtenso(minutosExigidos),
    },
    /* a frase do estúdio, pronta. `null` quando não há nada a avisar */
    avisoParaConfirmar: jaPassou
      ? null
      : avisoDeForaDoPrazo(veredito, `de ${data} às ${hora}`),
  })
})

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
 * **O crédito depende da antecedência.** Quem avisa em cima da hora desmarca
 * do mesmo jeito — a vaga abre, e recusar o cancelamento só faria a pessoa
 * sumir sem avisar —, mas não ganha a aula de volta. Quanto é "em cima da
 * hora" é `conta.minutos_minimos_cancelamento` (migration `0062`, antes em
 * horas na `0061`), que nasce `0` e vale 120 no MGM. A resposta diz
 * `temCredito` para o bot poder avisar antes de confirmar.
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
  if (p.status === 'falta_avisada' || p.status === 'falta') {
    return NextResponse.json({
      participacaoId: p.id,
      status: p.status,
      jaEstavaAssim: true,
      temCredito: p.status === 'falta_avisada',
    })
  }

  /*
   * O aviso é agora: quem chama esta rota é o bot, no instante em que a pessoa
   * mandou a mensagem. É esse instante que decide o crédito, e é por isso que
   * ele vai para `avisado_em` em vez de ficar só em `registrado_em` — que
   * continua sendo quando a linha foi escrita.
   */
  const avisadoEm = new Date()

  const { data: conta } = await ctx.db
    .from('conta')
    .select('minutos_minimos_cancelamento')
    .eq('id', ctx.contaId)
    .maybeSingle()

  const veredito = avaliarAviso(
    avisadoEm,
    new Date(sessao.inicio),
    (conta as { minutos_minimos_cancelamento: number } | null)?.minutos_minimos_cancelamento ?? 0,
  )

  /*
   * Sem crédito vira `falta`, e não `falta_avisada`.
   *
   * As duas liberam a vaga; só a segunda entra na lista de reposição em aberto
   * (índice `participacao_falta_aberta_ix`, e a busca da `0034`). Gravar
   * `falta_avisada` para quem avisou tarde daria a reposição de volta pela
   * porta dos fundos, que é exatamente o que o estúdio pediu para não
   * acontecer.
   */
  const { error } = await ctx.db.from('participacao').update({
    status: veredito.temCredito ? 'falta_avisada' : 'falta',
    avisado_em: avisadoEm.toISOString(),
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
    status: veredito.temCredito ? 'falta_avisada' : 'falta',
    jaEstavaAssim: false,
    temCredito: veredito.temCredito,
    minutosDeAntecedencia: Math.round(veredito.minutosDeAntecedencia),
    minutosExigidos: veredito.minutosExigidos,
  })
})
