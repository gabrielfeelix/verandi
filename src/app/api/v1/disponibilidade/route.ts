import { NextResponse, type NextRequest } from 'next/server'
import { horariosLivres } from '@/server/agenda/disponibilidade'
import { comChave, erroDePedido, type Contexto } from '@/server/api/rota'
import { dataValida, idValido, intervaloValido, primeiro } from '@/core/api/pedido'
import type { SessaoResumo } from '@/server/agenda/consultas'

/**
 * Os horários que o bot pode oferecer.
 *
 * **Cheio não é resultado.** Se a turma tem cinco vagas e cinco pessoas, aquele
 * horário sai em `cheios` e nunca em `livres` — e o bot só oferece `livres`. Ele
 * não abre turma, não muda capacidade e não passa da lotação: encaixe acima é
 * decisão de quem está no balcão, com nome e registro.
 *
 * `cheios` vem junto porque o bot precisa saber a diferença entre "não existe
 * horário nesse dia" e "existe e está lotado". As duas conversas são
 * diferentes: a segunda vira lista de espera na Fase 5.
 *
 * A tela `/vaga` chama exatamente a mesma função. Divergência entre o que a
 * recepção vê e o que o bot promete destrói a confiança no sistema inteiro, e é
 * por isso que aqui não há consulta própria.
 *
 *   GET /api/v1/disponibilidade?de=2026-08-15&ate=2026-08-22
 *                              [&servico=][&profissional=][&local=]
 */

function comoJson(s: SessaoResumo) {
  return {
    sessaoId: s.id,
    data: s.data,
    hora: s.hora,
    duracaoMin: s.duracaoMin,
    servico: s.servico,
    profissionalId: s.profissionalId,
    profissional: s.profissional,
    localId: s.localId,
    local: s.local,
    // o bot monta a frase com isto: "restam 2 vagas"
    capacidade: s.ocupacao.capacidade,
    ocupadas: s.ocupacao.ocupadas,
    livres: s.ocupacao.livres,
  }
}

export const GET = comChave(async (req: NextRequest, ctx: Contexto) => {
  const p = req.nextUrl.searchParams
  const de = p.get('de')
  const ate = p.get('ate')

  const ruim = primeiro(
    dataValida(de, 'de'),
    dataValida(ate, 'ate'),
    idValido(p.get('servico'), 'servico'),
    idValido(p.get('profissional'), 'profissional'),
    idValido(p.get('local'), 'local'),
  )
  if (ruim) return erroDePedido(ruim)

  const janela = intervaloValido(de!, ate!)
  if (janela) return erroDePedido(janela)

  const { livres, cheios } = await horariosLivres(ctx.db, ctx.contaId, {
    de: de!,
    ate: ate!,
    servicoId: p.get('servico') ?? undefined,
    profissionalId: p.get('profissional') ?? undefined,
    localId: p.get('local') ?? undefined,
  })

  return NextResponse.json({
    de, ate,
    livres: livres.map(comoJson),
    cheios: cheios.map(comoJson),
  })
})
