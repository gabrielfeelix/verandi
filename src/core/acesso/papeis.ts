/**
 * Os papéis que o dono de uma conta pode conceder.
 *
 * `suporte` fica **fora** de propósito: é o papel da 4YU, que enxerga conta de
 * cliente e entra como suporte. Se ele estivesse aqui, o dono de qualquer conta
 * se promoveria convidando o próprio e-mail — escalada de privilégio em dois
 * cliques.
 */
export const PAPEIS_CONVIDAVEIS = ['dono', 'recepcao', 'profissional'] as const
export type PapelConvidavel = (typeof PAPEIS_CONVIDAVEIS)[number]

export const NOME_PAPEL: Record<string, string> = {
  dono: 'Dono',
  recepcao: 'Recepção',
  profissional: 'Profissional',
  suporte: 'Suporte 4YU',
}
