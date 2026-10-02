/**
 * O limite da semana de quem tem plano de horário livre.
 *
 * Semana de segunda a domingo, no fuso da conta: a aula de domingo às 20h é da
 * semana que está acabando, e não da que começa amanhã.
 *
 * Conta o que **ocupa** a semana: marcada, confirmada, presente e falta. Falta
 * avisada, licença e cancelada devolvem o lugar, porque a pessoa avisou a
 * tempo ou o negócio cancelou. Sessão cancelada também não conta.
 */

const OCUPAM = new Set(['esperada', 'confirmada', 'presente', 'falta'])

/** A data local (AAAA-MM-DD) de um instante, no fuso da conta. */
export function dataLocal(instante: string, fuso: string): string {
  return new Date(instante).toLocaleDateString('en-CA', { timeZone: fuso })
}

/** A segunda-feira da semana de uma data AAAA-MM-DD. */
export function segundaDaSemana(data: string): string {
  const d = new Date(`${data}T12:00:00Z`)
  const recuo = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - recuo)
  return d.toISOString().slice(0, 10)
}

export function aulasNaSemana(
  marcadas: Array<{ inicio: string; status: string; sessaoCancelada?: boolean }>,
  inicioDaSessao: string,
  fuso: string,
): number {
  const semana = segundaDaSemana(dataLocal(inicioDaSessao, fuso))
  return marcadas.filter((m) =>
    OCUPAM.has(m.status)
    && !m.sessaoCancelada
    && segundaDaSemana(dataLocal(m.inicio, fuso)) === semana,
  ).length
}
