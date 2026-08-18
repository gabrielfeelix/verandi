/**
 * As posições da avaliação por foto.
 *
 * As seis abaixo vieram do pilates, que foi quem pediu, e ficam como **ponto de
 * partida**, não como lista fechada: a ortodontia fotografa perfil e arcada, a
 * estética fotografa a região tratada, e a fisioterapia fotografa o lado
 * lesionado. Por isso a posição é linha da conta, e estas seis só existem para
 * a primeira avaliação não começar numa tela vazia.
 */
export const POSICOES_PADRAO = [
  'Frente',
  'Lateral direita',
  'Lateral esquerda',
  'Costas',
  'Flexão de coluna',
  'Pés',
] as const

export type Posicao = { nome: string; ordem: number }

/**
 * Empate de ordem se resolve pelo nome, e não pela ordem de chegada do banco.
 *
 * Duas posições criadas no mesmo segundo trocariam de lugar entre uma visita e
 * outra, e a matriz de comparação mudaria de forma sozinha, sem ninguém ter
 * mexido em nada. Quem compara postura precisa que a linha de cima seja sempre
 * a mesma linha de cima.
 */
export function ordenarPosicoes<T extends Posicao>(linhas: readonly T[]): T[] {
  return [...linhas].sort(
    (a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'),
  )
}

/** A posição nova entra no fim, onde quem a criou espera encontrá-la. */
export function proximaOrdem(linhas: readonly Posicao[]): number {
  return linhas.reduce((maior, p) => Math.max(maior, p.ordem), 0) + 1
}
