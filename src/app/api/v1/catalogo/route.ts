import { NextResponse, type NextRequest } from 'next/server'
import { catalogoDaGrade } from '@/server/grade/consultas'
import { carregarVocabulario, resolverRotulos } from '@/server/vocabulario'
import { comChave, type Contexto } from '@/server/api/rota'

/**
 * O que o bot precisa para montar a pergunta.
 *
 * Serviços, profissionais e locais **ativos**: desativado não aparece, pela
 * mesma razão de não aparecer nas escolhas da tela. O bot não deve oferecer
 * "Pilates avançado" que o estúdio parou de dar em março.
 *
 * O **vocabulário** vem junto, e é o que faz o bot falar a língua do negócio.
 * Sem ele o robô de um estúdio de pilates escreve "escolha o serviço" enquanto
 * a tela do mesmo cliente escreve "escolha a modalidade", e o cliente percebe
 * antes da segunda mensagem.
 *
 * O **funcionamento** também: dia sem linha é dia fechado, e é o que separa
 * "não tem horário nesse sábado" de "a casa não abre no sábado". Duas frases
 * diferentes para quem está do outro lado da conversa.
 *
 *   GET /api/v1/catalogo
 */
export const GET = comChave(async (_req: NextRequest, ctx: Contexto) => {
  const [catalogo, voc] = await Promise.all([
    catalogoDaGrade(ctx.db, ctx.contaId),
    carregarVocabulario(ctx.db, ctx.contaId),
  ])
  const rotulos = resolverRotulos(voc)

  return NextResponse.json({
    servicos: catalogo.servicos,
    profissionais: catalogo.profissionais,
    locais: catalogo.locais,
    funcionamento: catalogo.funcionamento,
    vocabulario: rotulos,
  })
})
