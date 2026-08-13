/**
 * As seis tintas com significado, e o que cada uma quer dizer no domínio.
 *
 * A cor **nunca é o único portador do significado**: quem usa estas classes
 * escreve texto ou glifo junto. Daltonismo e impressão em preto e branco não são
 * casos raros.
 */
export type Tinta = 'positivo' | 'atencao' | 'alerta' | 'info' | 'licenca' | 'neutro'

export const TINTA: Record<Tinta, string> = {
  positivo: 'bg-positivo-fundo text-positivo',
  atencao: 'bg-atencao-fundo text-atencao',
  alerta: 'bg-alerta-fundo text-alerta',
  info: 'bg-info-fundo text-info',
  licenca: 'bg-licenca-fundo text-licenca',
  neutro: 'bg-neutro-fundo text-neutro',
}

/** Como a pessoa entrou nesta sessão. */
export const TINTA_ORIGEM = {
  recorrente: 'positivo',
  avulso: 'info',
  reposicao: 'atencao',
  encaixe: 'alerta',
  reserva: 'neutro',
} as const satisfies Record<string, Tinta>

/** O estado da chamada de uma sessão. */
export const TINTA_CHAMADA = {
  feita: 'positivo',
  pendente: 'alerta',
  sem_ninguem: 'neutro',
} as const satisfies Record<string, Tinta>

/** O que aconteceu com a pessoa naquele horário. */
export const TINTA_PRESENCA = {
  esperada: 'neutro',
  confirmada: 'info',
  presente: 'positivo',
  falta: 'alerta',
  falta_avisada: 'atencao',
  licenca: 'licenca',
  cancelada: 'neutro',
} as const satisfies Record<string, Tinta>

/** O glifo que acompanha a cor, porque cor sozinha não informa. */
export const GLIFO_PRESENCA = {
  esperada: '',
  confirmada: '·',
  presente: '✓',
  falta: '×',
  falta_avisada: '!',
  licenca: '~',
  cancelada: '—',
} as const

/**
 * Seis pares para avatar, escolhidos por hash do nome.
 *
 * Determinístico de propósito: a mesma pessoa tem a mesma cor em toda tela, e
 * isso é o que faz reconhecer alguém de relance numa lista de quarenta.
 */
export const PARES_AVATAR = [
  ['#DCEDE7', '#0E7C6B'],
  ['#E4E9F5', '#42507A'],
  ['#FBE4D9', '#B4562F'],
  ['#E9E6F3', '#5B4C7C'],
  ['#E5EFDC', '#4E6B37'],
  ['#F6E7C9', '#8A6A22'],
] as const

/** As cores que um profissional pode ter na grade. */
export const CORES_PROFISSIONAL = [
  { nome: 'Verde', valor: '#0E7C6B' },
  { nome: 'Laranja', valor: '#F0693C' },
  { nome: 'Azul', valor: '#4A5C8C' },
  { nome: 'Violeta', valor: '#5B4C7C' },
] as const
