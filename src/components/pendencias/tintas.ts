/*
 * As tintas dos grupos de pendência, num módulo sem `'use client'`.
 *
 * Não é organização: a lista é cliente e o "Resumo" da coluna direita é
 * servidor. Exportar a constante do módulo cliente e importá-la no servidor
 * devolve uma referência de módulo, não o objeto — e o ponto colorido some da
 * tela sem que nada quebre nem apareça no `tsc`.
 */

/** A tinta de cada grupo, a mesma do cartão de Hoje. */
export const TINTA_GRUPO: Record<string, string> = {
  chamada_nao_feita: 'bg-alerta-fundo text-alerta',
  reposicao_aberta: 'bg-atencao-fundo text-atencao',
  reserva_esperando: 'bg-info-fundo text-info',
  cadastro_incompleto: 'bg-neutro-fundo text-tinta-media',
}

/** O mesmo par, chapado, para o ponto do "Resumo". */
export const PONTO_GRUPO: Record<string, string> = {
  chamada_nao_feita: 'bg-alerta',
  reposicao_aberta: 'bg-atencao',
  reserva_esperando: 'bg-info',
  cadastro_incompleto: 'bg-tinta-fraca',
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
  reserva_esperando: 'Encaixar',
  cadastro_incompleto: 'Completar',
}
