import { NextResponse, type NextRequest } from 'next/server'
import { fichaDaPessoa } from '@/server/pessoas/consultas'
import { situacaoDe } from '@/core/pessoas/situacao'
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
    proximas: ficha.proximas.map((p) => ({
      participacaoId: p.id,
      sessaoId: p.sessaoId,
      data: p.data,
      hora: p.hora,
      servico: p.servico,
      origem: p.origem,
      status: p.status,
    })),

    /* "você tem duas reposições para marcar" */
    reposicoesAbertas: ficha.reposicoesAbertas.map((p) => ({
      participacaoId: p.id,
      data: p.data,
      hora: p.hora,
      servico: p.servico,
      motivo: p.status,
    })),
  })
})
