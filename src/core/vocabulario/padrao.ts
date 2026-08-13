export type ChaveVocabulario =
  | 'pessoa' | 'profissional' | 'servico' | 'local' | 'serie' | 'sessao' | 'vaga'

export type Rotulo = { singular: string; plural: string }
export type Vocabulario = Partial<Record<ChaveVocabulario, Rotulo>>

/**
 * O padrão é deliberadamente neutro. "Aluno", "Turma" e "Paciente" são
 * vocabulário de um cliente, e vocabulário de cliente é configuração.
 *
 * Há um teste que falha se alguma dessas palavras aparecer aqui.
 */
export const PADRAO: Record<ChaveVocabulario, Rotulo> = {
  pessoa:       { singular: 'Pessoa',       plural: 'Pessoas' },
  profissional: { singular: 'Profissional', plural: 'Profissionais' },
  servico:      { singular: 'Serviço',      plural: 'Serviços' },
  local:        { singular: 'Local',        plural: 'Locais' },
  serie:        { singular: 'Horário fixo', plural: 'Horários fixos' },
  sessao:       { singular: 'Sessão',       plural: 'Sessões' },
  vaga:         { singular: 'Vaga',         plural: 'Vagas' },
}
