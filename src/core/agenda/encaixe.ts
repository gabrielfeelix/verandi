import type { Ocupacao } from './ocupacao'

export type Veredito = {
  cabe: boolean
  motivo?: 'ja_participa' | 'lotada'
  /** lotada tem saída: subir a capacidade da sessão. duplicata não tem. */
  podeAbrirVaga?: boolean
  /**
   * Cabe, mas passa da capacidade. Quem chama **precisa** avisar antes de
   * gravar: `5/4` é sempre alguém decidindo, nunca o sistema deixando passar.
   */
  acimaDaCapacidade?: boolean
}

/**
 * O encaixe visto do balcão.
 *
 * Quando a conta permite encaixe acima da capacidade, a pessoa da recepção,
 * olhando para quem está na frente dela, pode abrir exceção — e a exceção fica
 * marcada. Quando não permite, lotada é lotada e a saída é subir a capacidade
 * daquela sessão, que faz a vaga existir de verdade para todo mundo ao mesmo
 * tempo.
 *
 * O que **não** muda com a configuração é a outra ponta: `temVagaParaOferecer`
 * continua recusando horário cheio. A recepção decide; a busca de vaga e o robô
 * não decidem nada — eles só listam o que está livre. Sem essa separação, o bot
 * confirmaria sozinho a sexta pessoa numa turma de quatro, às onze da noite,
 * sem ninguém ver.
 */
export function avaliarEncaixe(
  ocupacao: Ocupacao,
  jaParticipa: boolean,
  permiteAcima = false,
): Veredito {
  if (jaParticipa) return { cabe: false, motivo: 'ja_participa', podeAbrirVaga: false }
  if (ocupacao.livres > 0) return { cabe: true }
  if (permiteAcima) return { cabe: true, acimaDaCapacidade: true, podeAbrirVaga: true }
  return { cabe: false, motivo: 'lotada', podeAbrirVaga: true }
}

/**
 * A pergunta da busca de vaga e do endpoint `/disponibilidade`, que precisam
 * dar exatamente a mesma resposta. Cheio não entra na lista, e isso **não é
 * configurável**: oferecer o que não cabe é prometer o que não existe.
 */
export function temVagaParaOferecer(ocupacao: Ocupacao): boolean {
  return ocupacao.livres > 0
}
