-- Tudo aqui nasce em `app_verandi`. `public` fica fora do caminho de
-- propósito: é onde o AutoFluxos mora, e nome sem schema não pode cair lá por
-- acidente. Ver 0030.
set search_path = app_verandi, extensions;

/*
 * O prazo para avisar, e a hora em que a pessoa avisou.
 *
 * A `0037` criou `credito_falta_avisada` e escreveu, no comentário, a razão de
 * a opção "só com 3h de antecedência" não ter saído: *"hoje não guardamos
 * quando a pessoa avisou, só quando a recepção digitou"*. É esse buraco que
 * esta migration fecha — e ele voltou pela porta da frente agora que o bot
 * desmarca sozinho, às vezes quinze minutos antes da aula.
 *
 * **`registrado_em` não serve para essa conta.** Ele diz quando a linha foi
 * escrita. Quando a recepção anota no fim do dia a ligação que recebeu de
 * manhã, os dois instantes ficam a horas de distância, e usar o da digitação
 * tiraria a reposição de quem avisou direito. São duas perguntas diferentes e
 * agora são duas colunas.
 */

alter table participacao
  /*
   * Quando **a pessoa** avisou que não vem.
   *
   * Anulável porque a maioria das linhas não é cancelamento, e porque a
   * importação do histórico não tem como saber esse instante. Nulo significa
   * "não sabemos", e quem lê decide: a regra do crédito trata desconhecido
   * como avisado a tempo, que é o lado que não tira direito de ninguém por
   * causa de dado que o sistema não tinha.
   */
  add column avisado_em timestamptz;

comment on column participacao.avisado_em is
  'Quando a PESSOA avisou que não vem — diferente de registrado_em, que é '
  'quando a linha foi escrita. É esta coluna que decide o crédito de reposição.';

/*
 * Quantas horas antes vale como aviso.
 *
 * Número na conta, e não constante no código: o MGM pede 2h e o próximo
 * estúdio vai pedir 12h.
 *
 * **Nasce `0`, que é "todo aviso vale" — e não 2.** O padrão precisa ser o
 * comportamento de hoje: até esta migration, qualquer aviso gerava crédito, e
 * nascer com 2 tiraria a reposição de quem cancelasse em cima da hora em toda
 * conta que existe, sem ninguém ter pedido e sem aparecer em tela nenhuma. A
 * regra do MGM entra como `update` explícito, com nome e data, logo abaixo.
 */
alter table conta
  add column horas_minimas_cancelamento integer not null default 0
    check (horas_minimas_cancelamento >= 0);

/*
 * A regra do MGM Pilates, que é de onde o pedido veio: avisar com 2h.
 *
 * Por `nome`, e não por id fixo: id de conta não é constante de migration, e
 * um `where` que não casa com nada é um `update` de zero linhas — silencioso,
 * do jeito certo. Se a conta tiver outro nome, ninguém é afetado.
 */
update conta set horas_minimas_cancelamento = 2 where nome = 'MGM Pilates';

comment on column conta.horas_minimas_cancelamento is
  'Antecedência mínima, em horas, para um aviso de falta gerar crédito de '
  'reposição. 0 = qualquer aviso vale.';

grant select, insert, update, delete on all tables in schema app_verandi to authenticated;
grant all on all tables in schema app_verandi to service_role;
