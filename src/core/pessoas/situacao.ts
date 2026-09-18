export const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

type Entrada = {
  ativo: boolean
  faltasRecentes: number
  vencimentoPlano: string | null
}

export type Situacao = {
  rotulo: string
  tinta: 'positivo' | 'atencao' | 'alerta' | 'neutro'
}

/** Dias até o vencimento; negativo quando ele já passou. */
function diasAte(vencimento: string, hoje: Date): number {
  return Math.floor(
    (Date.parse(`${vencimento}T12:00:00Z`)
      - Date.parse(`${hoje.toISOString().slice(0, 10)}T12:00:00Z`)) / 864e5,
  )
}

/**
 * A situação de alguém na lista, em uma palavra.
 *
 * A ordem é de urgência, não de gravidade: quem parou já está resolvido
 * (inativa), quem perdeu ou está prestes a perder o plano é a única linha com
 * prazo, e quem faltou duas vezes seguidas é a que some se ninguém ligar.
 *
 * **"Plano vencido" e "plano vencendo" são coisas diferentes**, e por um tempo
 * foram a mesma palavra: a conta caía num `<= 15` que um vencimento de quatro
 * meses atrás também satisfaz. Quem vence sexta recebe uma ligação de
 * renovação; quem venceu em maio e não voltou recebe outra conversa, ou sai da
 * lista. O estúdio mantém de propósito, entre os ativos, gente com contrato
 * vencido de quem ainda espera retorno — e é justamente essa lista que a
 * palavra errada escondia.
 *
 * "Tem crédito de reposição" **não** entra aqui de propósito: é tarefa da casa,
 * não estado da pessoa, e já tem a tela de Pendências inteira para ela.
 */
export function situacaoDe(p: Entrada, hoje = new Date()): Situacao {
  if (!p.ativo) return { rotulo: 'inativa', tinta: 'neutro' }

  if (p.vencimentoPlano) {
    const emQuantosDias = diasAte(p.vencimentoPlano, hoje)
    if (emQuantosDias < 0) return { rotulo: 'plano vencido', tinta: 'alerta' }
    if (emQuantosDias <= 15) return { rotulo: 'plano vencendo', tinta: 'atencao' }
  }

  if (p.faltasRecentes >= 2) return { rotulo: 'faltando', tinta: 'alerta' }

  return { rotulo: 'ativa', tinta: 'positivo' }
}
