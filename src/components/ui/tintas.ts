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

/**
 * A mesma tinta, chapada, para quando ela é o fundo e não a letra.
 *
 * É o que o selo no canto do avatar usa: lá a cor precisa aguentar um glifo
 * branco em cima, e o par claro da tabela acima não aguenta.
 */
export const TINTA_CHAPADA: Record<Tinta, string> = {
  positivo: 'bg-positivo',
  atencao: 'bg-atencao',
  alerta: 'bg-alerta',
  info: 'bg-info',
  licenca: 'bg-licenca',
  neutro: 'bg-tinta-fraca',
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
  cancelada: 'sem registro',
} as const

/**
 * Seis pares para avatar, escolhidos por hash do nome: fundo chapado escuro,
 * inicial clara.
 *
 * Determinístico de propósito: a mesma pessoa tem a mesma cor em toda tela, e
 * isso é o que faz reconhecer alguém de relance numa lista de quarenta.
 *
 * Eram fundos pastel com a letra na cor forte, e com o anel do profissional
 * por cima a borda ficava da grossura do traço das letras: as iniciais
 * pareciam contornadas. Fundo escuro com letra clara passa de 4,5:1 em todos.
 */
export const PARES_AVATAR = [
  ['#0B6B5C', '#E6F4EF'],
  ['#3A4870', '#E9EDF7'],
  ['#9A4524', '#FDEEE6'],
  ['#4F416E', '#EFEBF7'],
  ['#435D2F', '#EDF4E6'],
  ['#735818', '#FBF1DC'],
] as const

/** As cores que um profissional pode ter na grade. */
export const CORES_PROFISSIONAL = [
  { nome: 'Verde', valor: '#0E7C6B' },
  { nome: 'Laranja', valor: '#F0693C' },
  { nome: 'Azul', valor: '#4A5C8C' },
  { nome: 'Violeta', valor: '#5B4C7C' },
] as const

/**
 * O tamanho da letra das iniciais, a partir do círculo **útil**: o diâmetro
 * menos o anel ou a borda que come a beirada.
 *
 * Cada avatar tinha o seu número escrito à mão, e os pequenos passavam de 0,45
 * do círculo: "MW" encostava no contorno, e na pilha da agenda o anel do
 * vizinho cortava a segunda letra. 0,38 deixa folga até para as duas letras
 * mais largas, e o piso de 8,5px é o menor que ainda se lê.
 */
export function fonteDasIniciais(diametroUtil: number): number {
  return Math.max(8.5, Math.round(diametroUtil * 0.38 * 2) / 2)
}
