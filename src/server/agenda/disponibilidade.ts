import { temVagaParaOferecer } from '@/core/agenda/encaixe'
import { cabeNaJanela, diaDaSemana, lerJanela } from '@/core/agenda/experimental'
import type { Db } from '../supabase'
import { sessoesDoIntervalo, type SessaoResumo } from './consultas'

/**
 * Os serviços que recebem aula experimental, com a grade de cada um.
 *
 * Uma consulta só para todos os serviços da conta, e não uma por sessão: a
 * janela é do serviço, não da sessão, e a agenda de uma semana tem dezenas de
 * sessões repetindo o mesmo punhado de serviços.
 */
async function gradeExperimental(db: Db, contaId: string) {
  const { data, error } = await db
    .from('servico')
    .select('id, aceita_experimental, janela_experimental')
    .eq('conta_id', contaId)
    .eq('aceita_experimental', true)

  if (error) throw error

  const por = new Map<string, ReturnType<typeof lerJanela>>()
  for (const s of data ?? []) {
    por.set(s.id as string, lerJanela((s as { janela_experimental: unknown }).janela_experimental))
  }
  return por
}

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
 *
 * **`experimental` estreita a agenda, nunca a alarga.** Quem nunca veio ao
 * estúdio só pode ver o que o estúdio aceita dar como aula experimental: no
 * MGM, só Pilates aparelho, e nem em todo horário. Um serviço que ninguém
 * marcou como experimental não aparece — e nascer fechado (migration `0060`) é
 * o que impede esta linha de oferecer a Fisioterapia inteira no dia em que
 * subir.
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
    /** só o que pode ser oferecido como aula experimental */
    experimental?: boolean
  },
): Promise<{ livres: SessaoResumo[]; cheios: SessaoResumo[] }> {
  const sessoes = await sessoesDoIntervalo(db, contaId, opts.de, opts.ate, {
    servicoId: opts.servicoId,
    profissionalId: opts.profissionalId,
    localId: opts.localId,
  })

  let abertas = sessoes.filter((s) => s.status !== 'cancelada')

  if (opts.experimental) {
    const grade = await gradeExperimental(db, contaId)
    abertas = abertas.filter((s) => {
      if (!grade.has(s.servicoId)) return false
      return cabeNaJanela(grade.get(s.servicoId) ?? null, diaDaSemana(s.data), s.hora)
    })
  }

  return {
    livres: abertas.filter((s) => temVagaParaOferecer(s.ocupacao)),
    cheios: abertas.filter((s) => !temVagaParaOferecer(s.ocupacao)),
  }
}

/** O formato que o bloco de pergunta dinâmica do AutoFluxos consome direto. */
export function comoPontoEVirgula(sessoes: SessaoResumo[]): string {
  return [...new Set(sessoes.map((s) => s.hora.replace(':', 'h')))].join(';')
}
