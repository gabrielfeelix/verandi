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

/**
 * A situação de alguém na lista, em uma palavra.
 *
 * A ordem é de urgência, não de gravidade: quem parou já está resolvido
 * (inativa), quem está prestes a perder o plano é a única linha com prazo, e
 * quem faltou duas vezes seguidas é a que some se ninguém ligar.
 *
 * "Tem crédito de reposição" **não** entra aqui de propósito: é tarefa da casa,
 * não estado da pessoa, e já tem a tela de Pendências inteira para ela.
 */
export function situacaoDe(p: Entrada, hoje = new Date()): Situacao {
  if (!p.ativo) return { rotulo: 'inativa', tinta: 'neutro' }

  if (p.vencimentoPlano) {
    const emQuantosDias = Math.floor(
      (Date.parse(`${p.vencimentoPlano}T12:00:00Z`)
        - Date.parse(`${hoje.toISOString().slice(0, 10)}T12:00:00Z`)) / 864e5,
    )
    if (emQuantosDias <= 15) return { rotulo: 'plano vencendo', tinta: 'atencao' }
  }

  if (p.faltasRecentes >= 2) return { rotulo: 'faltando', tinta: 'alerta' }

  return { rotulo: 'ativa', tinta: 'positivo' }
}
