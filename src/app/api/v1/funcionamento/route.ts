import { NextResponse, type NextRequest } from 'next/server'
import { carregarFuncionamento, listarDatasFechadas } from '@/server/config/consultas'
import { hojeEm } from '@/server/agenda/fuso'
import { comChave, type Contexto } from '@/server/api/rota'

/**
 * Quando a casa abre, e em que dias ela não abre.
 *
 * **Quem pergunta é o bot, e a pergunta não é sobre vaga.** `/disponibilidade`
 * responde "que horários existem nesse dia"; esta rota responde "vocês estão
 * abertos agora, e se não, quando voltam". São conversas diferentes: quem
 * escreve às 22h de um feriado não quer uma lista vazia de horários, quer
 * ouvir que hoje é feriado e que amanhã tem gente.
 *
 * O expediente já mora aqui, na configuração da agenda, e era isso que fazia o
 * cliente configurar a mesma coisa duas vezes: uma na Verandi, para a grade, e
 * outra no AutoFluxos, para o bot. Duas cópias da mesma verdade divergem no
 * primeiro feriado, e quem paga é quem manda mensagem.
 *
 * O formato é o que o AutoFluxos guarda (`core/horario.ts`): `dias` com sete
 * listas, domingo primeiro, e `excecoes` por data. Traduzir aqui, e não lá,
 * deixa a tradução perto de quem conhece as duas tabelas.
 *
 *   GET /api/v1/funcionamento
 */
export const GET = comChave(async (_req: NextRequest, ctx: Contexto) => {
  const { data: conta } = await ctx.db
    .from('conta')
    .select('fuso')
    .eq('id', ctx.contaId)
    .maybeSingle()

  const fuso = (conta as { fuso: string | null } | null)?.fuso ?? 'America/Sao_Paulo'

  const [semana, fechadas] = await Promise.all([
    carregarFuncionamento(ctx.db, ctx.contaId),
    // Feriado que já passou não muda conversa nenhuma, e mandar o histórico
    // inteiro faria a cópia do outro lado crescer para sempre.
    listarDatasFechadas(ctx.db, ctx.contaId, hojeEm(fuso)),
  ])

  const dias: { de: string; ate: string }[][] = [[], [], [], [], [], [], []]
  for (const dia of semana) {
    // Dia sem hora é dia fechado, e é assim que a configuração o guarda: a
    // linha existe com `abre`/`fecha` nulos. Empurrar `null` para dentro da
    // faixa faria o outro lado abrir a casa num horário que não existe.
    if (!dia.abre || !dia.fecha) continue
    dias[dia.diaSemana]?.push({ de: dia.abre, ate: dia.fecha })
  }

  return NextResponse.json({
    fuso,
    dias,
    /*
     * `faixas` vai vazio de propósito: as duas exceções que a Verandi conhece
     * (`feriado` e `fechado`) fecham o dia inteiro. O campo existe no contrato
     * para a véspera de hora reduzida, que hoje só se cadastra do lado do
     * AutoFluxos.
     */
    excecoes: fechadas.map((f) => ({
      data: f.data,
      motivo: f.descricao ?? (f.tipo === 'feriado' ? 'feriado' : 'fechado'),
      faixas: [],
    })),
  })
})
