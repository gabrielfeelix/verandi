import type { StatusParticipacao } from './ocupacao'

export type EstadoChamada = 'sem_ninguem' | 'pendente' | 'feita'

/** Os status que significam "alguém já decidiu o que aconteceu com essa pessoa". */
const DECIDIDOS: ReadonlySet<string> = new Set([
  'presente', 'falta', 'falta_avisada', 'licenca', 'cancelada',
])

/**
 * O estado da chamada é **derivado**, não é coluna.
 *
 * Uma `sessao.chamada_feita` seria estado calculável guardado em dois lugares —
 * e no dia em que alguém mudar um status sem atualizar a coluna, a tela de Hoje
 * passa a mentir sobre o que falta fazer. Derivar custa um `filter`.
 *
 * `confirmada` conta como pendente de propósito: a pessoa avisou pelo bot que
 * vem, mas ninguém registrou se ela apareceu.
 */
export function estadoDaChamada(status: StatusParticipacao[]): EstadoChamada {
  if (status.length === 0) return 'sem_ninguem'
  return status.every((s) => DECIDIDOS.has(s)) ? 'feita' : 'pendente'
}
