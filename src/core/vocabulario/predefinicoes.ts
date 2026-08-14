import { PADRAO, type ChaveVocabulario, type Rotulo } from './padrao'

/**
 * O vocabulário pronto de cada tipo de negócio.
 *
 * Existe porque a primeira tela do produto decide se a pessoa continua: quem
 * abre um estúdio de pilates e lê "Pessoa", "Sessão" e "Horário fixo" conclui
 * que o sistema é de outro ramo. Escolher o tipo escreve as sete linhas de
 * `vocabulario` de uma vez, e tudo continua ajustável em Configuração depois.
 *
 * `neutro` não é enfeite nem preguiça: sem ele, alguém escolhe a predefinição
 * errada só para conseguir passar da tela, e aí o negócio inteiro fica com o
 * vocabulário de outro ramo.
 */
export type TipoDeNegocio = 'movimento' | 'beleza' | 'saude' | 'neutro'

export type Predefinicao = {
  tipo: TipoDeNegocio
  /** o nome que aparece no cartão de escolha */
  nome: string
  /** os exemplos que fazem a pessoa se reconhecer, sem ler a tabela inteira */
  exemplos: string
  palavras: Record<ChaveVocabulario, Rotulo>
}

export const PREDEFINICOES: Predefinicao[] = [
  {
    tipo: 'movimento',
    nome: 'Aulas e treino',
    exemplos: 'Pilates, yoga, funcional, dança, artes marciais',
    palavras: {
      pessoa:       { singular: 'Aluno',      plural: 'Alunos' },
      profissional: { singular: 'Professor',  plural: 'Professores' },
      servico:      { singular: 'Modalidade', plural: 'Modalidades' },
      local:        { singular: 'Sala',       plural: 'Salas' },
      serie:        { singular: 'Turma fixa', plural: 'Turmas fixas' },
      sessao:       { singular: 'Aula',       plural: 'Aulas' },
      vaga:         { singular: 'Matrícula',  plural: 'Matrículas' },
    },
  },
  {
    tipo: 'beleza',
    nome: 'Beleza e estética',
    exemplos: 'Salão, barbearia, manicure, estética',
    palavras: {
      pessoa:       { singular: 'Cliente',       plural: 'Clientes' },
      profissional: { singular: 'Profissional',  plural: 'Profissionais' },
      servico:      { singular: 'Serviço',       plural: 'Serviços' },
      local:        { singular: 'Cadeira',       plural: 'Cadeiras' },
      serie:        { singular: 'Horário fixo',  plural: 'Horários fixos' },
      sessao:       { singular: 'Atendimento',   plural: 'Atendimentos' },
      vaga:         { singular: 'Reserva',       plural: 'Reservas' },
    },
  },
  {
    tipo: 'saude',
    nome: 'Saúde e terapias',
    exemplos: 'Fisioterapia, psicologia, nutrição, fonoaudiologia',
    palavras: {
      pessoa:       { singular: 'Paciente',      plural: 'Pacientes' },
      profissional: { singular: 'Profissional',  plural: 'Profissionais' },
      servico:      { singular: 'Especialidade', plural: 'Especialidades' },
      local:        { singular: 'Consultório',   plural: 'Consultórios' },
      serie:        { singular: 'Horário fixo',  plural: 'Horários fixos' },
      sessao:       { singular: 'Sessão',        plural: 'Sessões' },
      vaga:         { singular: 'Vaga',          plural: 'Vagas' },
    },
  },
  {
    tipo: 'neutro',
    nome: 'Outro tipo de negócio',
    exemplos: 'As palavras neutras do sistema, ajustáveis em Configuração',
    palavras: PADRAO,
  },
]

export function predefinicao(tipo: TipoDeNegocio): Predefinicao {
  const achada = PREDEFINICOES.find((p) => p.tipo === tipo)
  if (!achada) throw new Error(`tipo de negócio desconhecido: ${tipo}`)
  return achada
}

export function ehTipoDeNegocio(v: string): v is TipoDeNegocio {
  return PREDEFINICOES.some((p) => p.tipo === v)
}

/**
 * A conta ainda fala a língua de fábrica?
 *
 * Não basta perguntar se há linha em `vocabulario`: a conta pode ter sido criada
 * com as palavras neutras escritas por extenso, e isso é o mesmo que não ter
 * escolhido. Quem já trocou uma palavra que seja, escolheu, e oferecer uma
 * predefinição depois disso seria propor desfazer decisão de gente.
 */
export function aindaNeutro(voc: Partial<Record<ChaveVocabulario, Rotulo>>): boolean {
  return (Object.keys(voc) as ChaveVocabulario[]).every(
    (chave) =>
      voc[chave]?.singular === PADRAO[chave].singular &&
      voc[chave]?.plural === PADRAO[chave].plural,
  )
}
