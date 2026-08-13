import type { Ocupacao } from './ocupacao'

export type Veredito = {
  cabe: boolean
  motivo?: 'ja_participa' | 'lotada'
  /** lotada tem saída: subir a capacidade da sessão. duplicata não tem. */
  podeAbrirVaga?: boolean
}

/**
 * Lotada é lotada.
 *
 * Cinco vagas com cinco pessoas é indisponível: a sexta pessoa não vê aquele
 * horário e o bot não oferece ele. Não existe "encaixar mesmo assim" — o número
 * na tela precisa ser sempre o que de fato cabe, senão a busca, a tela e o bot
 * passam a discordar entre si.
 *
 * O que existe é o profissional **aumentar a capacidade daquela sessão**. Aí a
 * vaga passa a existir de verdade, para todo mundo ao mesmo tempo, e a decisão
 * fica com quem dá a aula.
 */
export function avaliarEncaixe(ocupacao: Ocupacao, jaParticipa: boolean): Veredito {
  if (jaParticipa) return { cabe: false, motivo: 'ja_participa', podeAbrirVaga: false }
  if (ocupacao.livres > 0) return { cabe: true }
  return { cabe: false, motivo: 'lotada', podeAbrirVaga: true }
}

/**
 * A pergunta da busca de vaga e do endpoint `/disponibilidade`, que precisam
 * dar exatamente a mesma resposta. Cheio não entra na lista.
 */
export function temVagaParaOferecer(ocupacao: Ocupacao): boolean {
  return ocupacao.livres > 0
}
