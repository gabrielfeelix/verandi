/*
 * As tintas dos grupos de pendência, num módulo sem `'use client'`.
 *
 * Não é organização: a lista é cliente e o "Resumo" da coluna direita é
 * servidor. Exportar a constante do módulo cliente e importá-la no servidor
 * devolve uma referência de módulo, não o objeto, e o ponto colorido some da
 * tela sem que nada quebre nem apareça no `tsc`.
 */

/**
 * A tinta de cada grupo, a mesma do cartão de Hoje: cor sólida só no número.
 * O cabeçalho inteiro em pastel (salmão, bege, lilás) deixava a tela terrosa e
 * fazia cinco faixas coloridas disputarem o olho.
 */
export const TINTA_GRUPO: Record<string, string> = {
  chamada_nao_feita: 'bg-reg-falta text-white',
  reposicao_aberta: 'bg-solido-atencao text-white',
  licenca: 'bg-reg-licenca text-white',
  reserva_esperando: 'bg-reg-justificada text-white',
  cadastro_incompleto: 'bg-solido-neutro text-white',
  horario_sem_contrato: 'bg-reg-falta text-white',
  pacote_esgotado: 'bg-reg-falta text-white',
  pacote_acabando: 'bg-solido-atencao text-white',
  pacote_parado: 'bg-solido-neutro text-white',
}

/*
 * O verbo, e não "Resolver".
 *
 * Um botão que diz "Resolver" obriga a ler a linha inteira para saber o que vai
 * acontecer. "Marcar chamada" e "Agendar reposição" são ações diferentes, com
 * consequências diferentes, e a mão decide antes dos olhos numa lista de
 * dezesseis itens.
 */
export const ACAO_GRUPO: Record<string, string> = {
  chamada_nao_feita: 'Marcar chamada',
  reposicao_aberta: 'Agendar reposição',
  licenca: 'Voltou',
  reserva_esperando: 'Encaixar',
  cadastro_incompleto: 'Completar',
  horario_sem_contrato: 'Criar contrato',
  pacote_esgotado: 'Renovar pacote',
  pacote_acabando: 'Renovar pacote',
  // parado se resolve falando com a pessoa: a ficha tem o WhatsApp e o Marcar aula
  pacote_parado: 'Abrir ficha',
}

/** A mesma cor do grupo, para o ponto da coluna Tipo e do filtro. */
export const PONTO_GRUPO: Record<string, string> = {
  chamada_nao_feita: 'var(--color-reg-falta)',
  reposicao_aberta: 'var(--color-solido-atencao)',
  licenca: 'var(--color-reg-licenca)',
  reserva_esperando: 'var(--color-reg-justificada)',
  cadastro_incompleto: 'var(--color-solido-neutro)',
  horario_sem_contrato: 'var(--color-reg-falta)',
  pacote_esgotado: 'var(--color-reg-falta)',
  pacote_acabando: 'var(--color-solido-atencao)',
  pacote_parado: 'var(--color-solido-neutro)',
}

/** O nome curto do tipo, na coluna da tabela: o título do grupo é longo demais. */
export const ROTULO_TIPO: Record<string, string> = {
  chamada_nao_feita: 'Chamada',
  reposicao_aberta: 'Reposição',
  licenca: 'Licença',
  reserva_esperando: 'Reserva',
  cadastro_incompleto: 'Cadastro',
  horario_sem_contrato: 'Sem contrato',
  pacote_esgotado: 'Pacote esgotado',
  pacote_acabando: 'Pacote acabando',
  pacote_parado: 'Aulas a fazer',
}
