import { NextResponse, type NextRequest } from 'next/server'
import { fichaDaPessoa } from '@/server/pessoas/consultas'
import { situacaoDe } from '@/core/pessoas/situacao'
import { avaliarAviso, prazoPorExtenso } from '@/core/agenda/cancelamento'
import { comChave, erro, erroDePedido, type Contexto } from '@/server/api/rota'
import { idObrigatorio } from '@/core/api/pedido'

/**
 * A pessoa, do jeito que o bot precisa dela numa conversa.
 *
 * Três perguntas que aparecem toda hora no WhatsApp e que nenhuma rota
 * respondia: "quais são meus horários?", "quantas reposições eu tenho?" e
 * "quando eu vim pela última vez?". Sem esta rota o bot consegue marcar e não
 * consegue desmarcar, porque **o id da participação nunca chegou até ele**. Uma
 * API que só sabe criar produz uma agenda que só cresce.
 *
 * Vem tudo numa resposta só, e isso é decisão: conversa de WhatsApp é sequência
 * de mensagens rápidas, e três idas ao servidor entre "oi" e "confirmado" viram
 * silêncio do outro lado.
 *
 * **Cada próxima aula diz se ainda dá tempo de avisar.** Sem isso o bot só
 * descobre que a pessoa perdeu a reposição **depois** de já ter cancelado, e a
 * frase que o estúdio pediu — *"caso realize o cancelamento essa aula não
 * poderá ser reposta, deseja prosseguir?"* — não tem como ser dita, porque ela
 * precisa vir antes da decisão. O `DELETE` já devolvia o veredito; devolver só
 * lá é chegar tarde.
 *
 * **Observação não sai daqui, em nenhuma hipótese.** É onde mora "lesão no
 * ombro, não pode carga axial". A tela já separa quem lê, com padrão fechado;
 * mandar isso para um sistema de conversa abriria pela porta dos fundos o que as
 * migrations `0043` e `0044` fecharam pela frente. Nem entra, nem sai.
 *
 *   GET /api/v1/pessoas/<uuid>
 */
export const GET = comChave<{ id: string }>(async (
  req: NextRequest,
  ctx: Contexto,
  params,
) => {
  const ruim = idObrigatorio(params.id, 'id')
  if (ruim) return erroDePedido(ruim)

  /*
   * Lida como recepção, que é o lado seguro do erro: a ficha vem com a
   * observação já filtrada, e o que sai daqui é ainda menos que isso.
   */
  const ficha = await fichaDaPessoa(ctx.db, ctx.contaId, params.id, 'recepcao')
  if (!ficha) return erro(404, 'esta pessoa não existe nesta conta')

  /*
   * O prazo é da conta, e a conta pode mudá-lo na tela de Padrões a qualquer
   * momento. Lê-se aqui, a cada pedido, em vez de constante: uma cópia no
   * código seria uma segunda regra, que diverge no dia em que alguém mexer.
   */
  const { data: conta } = await ctx.db
    .from('conta')
    .select('minutos_minimos_cancelamento')
    .eq('id', ctx.contaId)
    .maybeSingle()

  const minutosExigidos =
    (conta as { minutos_minimos_cancelamento: number } | null)
      ?.minutos_minimos_cancelamento ?? 0

  const agora = new Date()

  const s = situacaoDe({
    ativo: ficha.pessoa.ativo,
    faltasRecentes: ficha.pessoa.faltasRecentes,
    vencimentoPlano: ficha.pessoa.vencimentoPlano,
  })

  return NextResponse.json({
    pessoaId: ficha.pessoa.id,
    nome: ficha.pessoa.nome,
    telefone: ficha.pessoa.telefone,
    ativa: ficha.pessoa.ativo,
    situacao: s.rotulo,
    ultimaPresenca: ficha.pessoa.ultimaPresenca,

    /* os horários fixos dela: é o que responde "eu venho terça e quinta" */
    horariosFixos: ficha.vagas.map((v) => ({
      vagaId: v.id,
      diaSemana: v.diaSemana,
      hora: v.horaInicio,
      servico: v.servico,
      profissional: v.profissional,
      desde: v.inicio,
      ate: v.fim,
    })),

    /* o que vem pela frente, **com o id da participação**, que é o que permite
       desmarcar depois sem o bot ter que adivinhar */
    proximas: ficha.proximas.map((p) => {
      /*
       * O veredito é calculado para **agora**, que é quando a pessoa está
       * conversando. Ele envelhece: uma aula que ainda podia ser cancelada às
       * 13h já não pode às 14h. É por isso que quem grava a decisão é o
       * `DELETE`, que refaz a conta no instante do aviso — aqui é o que o bot
       * precisa para escolher a frase, não para valer como registro.
       */
      const v = avaliarAviso(agora, new Date(p.inicio), minutosExigidos)
      return {
        participacaoId: p.id,
        sessaoId: p.sessaoId,
        data: p.data,
        hora: p.hora,
        inicio: p.inicio,
        servico: p.servico,
        servicoId: p.servicoId,
        origem: p.origem,
        status: p.status,
        /* cancelar agora ainda dá direito à reposição? */
        podeReporSeCancelarAgora: v.temCredito,
        minutosAteAula: Math.round(v.minutosDeAntecedencia),
      }
    }),

    /* "você tem duas reposições para marcar" */
    reposicoesAbertas: ficha.reposicoesAbertas.map((p) => ({
      participacaoId: p.id,
      data: p.data,
      hora: p.hora,
      servico: p.servico,
      /* o id vai junto do nome: é ele que `/disponibilidade?servico=` aceita, e
         sem ele a busca da reposição não tem como ficar na mesma modalidade */
      servicoId: p.servicoId,
      motivo: p.status,
    })),

    /*
     * A regra da conta, dita uma vez e por extenso.
     *
     * O bot precisa dela para montar a frase ("fora do prazo de 2h") sem ter
     * que traduzir minutos por conta própria — e traduzir na ponta é onde cada
     * integração inventa um texto diferente para a mesma regra.
     */
    regraDeCancelamento: {
      minutosMinimos: minutosExigidos,
      porExtenso: prazoPorExtenso(minutosExigidos),
    },
  })
})
