export type Papel = 'dono' | 'recepcao' | 'profissional' | 'suporte'

/**
 * Ninguém escolhe onde começar: o papel decide.
 *
 * Quem dá aula quer a agenda do dia; quem opera quer a semana inteira; o
 * suporte da 4YU quer a lista de contas dos clientes. Ver TELAS.md, "Regras
 * que valem em todas as telas".
 *
 * A lista do suporte é `/contas-4yu`, não `/contas`. As duas telas têm nome
 * parecido e propósito diferente: `/contas` é a troca de conta de quem
 * pertence a mais de uma. Mandar o suporte para lá deixava a tela em branco —
 * o suporte pertence a uma conta só (a interna), e `/contas` devolve quem tem
 * uma conta só para `destinoDoPapel`, que devolvia para `/contas`. Laço de
 * redirecionamento fechado, sem erro nenhum na tela.
 */
export function destinoDoPapel(papel: Papel): string {
  switch (papel) {
    case 'profissional': return '/hoje'
    case 'dono':
    case 'recepcao':     return '/semana'
    case 'suporte':      return '/contas-4yu'
  }
}
