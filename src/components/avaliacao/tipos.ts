/**
 * O que a tela da avaliação precisa saber, e nada além.
 *
 * A foto chega como endereço **assinado**, com prazo: o balde é privado, e o
 * componente nunca vê o caminho no Storage. Quem assina é `src/server`, que é
 * o único que sabe se quem está olhando pode olhar.
 */
export type FotoDaPosicao = {
  posicaoId: string
  url: string
  observacao: string | null
}

export type PosicaoNaTela = {
  id: string
  nome: string
  ordem: number
}

export type AvaliacaoNaTela = {
  id: string
  /** `YYYY-MM-DD` */
  data: string
  profissional: string | null
  observacao: string | null
  fotos: FotoDaPosicao[]
}
