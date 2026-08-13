export type Papel = 'dono' | 'recepcao' | 'profissional' | 'suporte'

/**
 * Ninguém escolhe onde começar: o papel decide.
 *
 * Quem dá aula quer a agenda do dia; quem opera quer a semana inteira; o
 * suporte da 4YU quer a lista de contas. Ver TELAS.md, "Regras que valem em
 * todas as telas".
 */
export function destinoDoPapel(papel: Papel): string {
  switch (papel) {
    case 'profissional': return '/hoje'
    case 'dono':
    case 'recepcao':     return '/semana'
    case 'suporte':      return '/contas'
  }
}
