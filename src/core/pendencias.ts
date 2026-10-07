/**
 * Pendências que não se dispensam: saem da lista quando o problema acaba
 * (contrato criado, pacote renovado, aula marcada). `pendencia_dispensada`
 * nem aceita esses tipos no banco.
 *
 * Mora no core porque a lista (cliente) e a ação de dispensar (servidor)
 * fazem a mesma pergunta.
 */
export const SEM_DISPENSAR: ReadonlySet<string> = new Set([
  'horario_sem_contrato', 'pacote_esgotado', 'pacote_acabando', 'pacote_parado',
])
