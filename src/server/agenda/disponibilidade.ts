import { temVagaParaOferecer } from '@/core/agenda/encaixe'
import type { Db } from '../supabase'
import { sessoesDoIntervalo, type SessaoResumo } from './consultas'

/**
 * Os horários que podem ser oferecidos, e — em lista separada — os que estão
 * cheios.
 *
 * **Cheio não é resultado.** Se a turma tem cinco vagas e cinco pessoas, aquele
 * horário não aparece como opção, nem aqui nem para o bot. Misturar cheio com
 * livre é o que faz a recepção prometer vaga que não existe.
 *
 * Esta é a função que o endpoint `/api/v1/disponibilidade` vai usar no marco 2.
 * A tela e o bot precisam dar exatamente a mesma resposta: divergência entre
 * as duas destrói a confiança no sistema inteiro.
 */
export async function horariosLivres(
  db: Db,
  contaId: string,
  opts: {
    de: string
    ate: string
    servicoId?: string
    profissionalId?: string
    localId?: string
  },
): Promise<{ livres: SessaoResumo[]; cheios: SessaoResumo[] }> {
  const sessoes = await sessoesDoIntervalo(db, contaId, opts.de, opts.ate, {
    servicoId: opts.servicoId,
    profissionalId: opts.profissionalId,
    localId: opts.localId,
  })

  const abertas = sessoes.filter((s) => s.status !== 'cancelada')

  return {
    livres: abertas.filter((s) => temVagaParaOferecer(s.ocupacao)),
    cheios: abertas.filter((s) => !temVagaParaOferecer(s.ocupacao)),
  }
}

/** O formato que o bloco de pergunta dinâmica do AutoFluxos consome direto. */
export function comoPontoEVirgula(sessoes: SessaoResumo[]): string {
  return [...new Set(sessoes.map((s) => s.hora.replace(':', 'h')))].join(';')
}
