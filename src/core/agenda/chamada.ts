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

/**
 * Quanto antes do começo a chamada abre: uma hora.
 *
 * O estúdio quer marcar presença ou falta antes de a aula começar, e a regra
 * do Daniel (MGM, 08/out/2026) é que aviso com menos de uma hora já é falta,
 * não falta justificada. Abrir antes disso deixava um toque distraído dar
 * presença a quem nem saiu de casa; abrir só no começo obrigava a esperar.
 * Falta justificada continua valendo a qualquer momento antes da aula.
 */
export const CHAMADA_ABRE_ANTES_MS = 60 * 60 * 1000

/** O instante, em ms, em que a chamada desta aula abre. */
export function chamadaAbreEm(inicio: string): number {
  return Date.parse(inicio) - CHAMADA_ABRE_ANTES_MS
}
