import type { Db } from '../supabase'
import { instante } from '../agenda/fuso'
import {
  aulasPorProfissional, totalDoPeriodo, type AulasDoProfissional,
  type SessaoParaContar,
} from '@/core/relatorio/aulas'
import type { StatusParticipacao } from '@/core/agenda/ocupacao'

export type RelatorioDeAulas = {
  de: string
  ate: string
  linhas: AulasDoProfissional[]
  total: ReturnType<typeof totalDoPeriodo>
}

/**
 * As aulas do período, por profissional.
 *
 * Uma consulta só, e a contagem em `core/`: a tela e a planilha somam o mesmo
 * número sem repetir uma linha de conta, e o teste da regra não precisa de
 * banco.
 *
 * A janela passa pelo fuso da conta. `${de}T00:00:00Z` é meia-noite em Londres,
 * e no Brasil isso corta as três últimas horas do dia: a aula das 21h de sexta
 * cairia no sábado. O mesmo furo apareceu no fechamento do financeiro, em 18/08,
 * e só depois das 21h.
 */
export async function aulasDoPeriodo(
  db: Db, contaId: string, de: string, ate: string, fuso: string,
): Promise<RelatorioDeAulas> {
  const { data, error } = await db
    .from('sessao')
    .select(`inicio, status, motivo_cancelamento,
             profissional_id, profissional(nome),
             participacao(status)`)
    .eq('conta_id', contaId)
    .gte('inicio', instante(de, '00:00', fuso))
    .lte('inicio', instante(ate, '23:59', fuso))
    .returns<Array<{
      inicio: string
      status: string
      motivo_cancelamento: string | null
      profissional_id: string | null
      profissional: { nome: string } | null
      participacao: Array<{ status: string }>
    }>>()
  if (error) throw error

  const sessoes: SessaoParaContar[] = (data ?? []).map((s) => ({
    profissionalId: s.profissional_id,
    // sem nome não é linha anônima: é a linha que manda alguém arrumar a grade
    profissionalNome: s.profissional?.nome ?? 'Sem profissional',
    inicio: s.inicio,
    cancelada: s.status === 'cancelada',
    motivoCancelamento: s.motivo_cancelamento,
    status: (s.participacao ?? []).map((p) => p.status as StatusParticipacao),
  }))

  const linhas = aulasPorProfissional(sessoes, new Date().toISOString())
  return { de, ate, linhas, total: totalDoPeriodo(linhas) }
}
