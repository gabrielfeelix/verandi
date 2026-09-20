-- Tudo aqui nasce em `app_verandi`. `public` fica fora do caminho de
-- propósito: é onde o AutoFluxos mora, e nome sem schema não pode cair lá por
-- acidente. Ver 0030.
set search_path = app_verandi, extensions;

/*
 * O prazo de cancelamento passa a ser contado em minutos.
 *
 * A `0061` criou `horas_minimas_cancelamento integer`, e a escolha da unidade
 * foi pelo caso que existia: o MGM pede 2h, e "2" cabe num inteiro de horas.
 * O caso seguinte não cabe. Estúdio que quer meia hora de antecedência não tem
 * como dizer isso: `0.5` não entra num `integer`, e `check (>= 0)` deixa
 * passar só o arredondamento, que vira 0 (todo aviso vale) ou 1 (o dobro do
 * que se pediu). Nenhum dos dois é o que a pessoa configurou.
 *
 * Minuto é a unidade certa porque é a menor que alguém vai pedir de verdade.
 * Segundo seria precisão que ninguém usa numa regra de balcão, e hora já se
 * provou grossa demais na segunda conta que perguntou.
 *
 * **A coluna nova não substitui a antiga aqui.** Ela é criada, preenchida a
 * partir do que já existe (`horas * 60`, que é exato para todo valor gravado)
 * e a antiga fica para trás, sem ser lida. Derrubar a coluna na mesma migration
 * que introduz a substituta quebra a versão da aplicação que ainda está no ar
 * durante o deploy: por alguns segundos o código velho seleciona uma coluna que
 * já não existe, e o erro cai em cima de quem estiver usando o sistema. A queda
 * é uma migration própria, depois de o código novo estar em produção.
 */

alter table conta
  add column minutos_minimos_cancelamento integer not null default 0
    check (minutos_minimos_cancelamento >= 0);

/*
 * O que já estava configurado continua valendo, na unidade nova.
 *
 * Em 20/set/2026 são duas contas: MGM Pilates com 2h e 4YU com 0. A conversão
 * é `* 60` e não tem perda, porque a coluna de origem só guarda hora inteira.
 * Fazer a conta aqui, e não no código, é o que garante que nenhuma conta
 * acorde amanhã com um prazo diferente do que alguém escolheu.
 */
update conta set minutos_minimos_cancelamento = horas_minimas_cancelamento * 60;

comment on column conta.minutos_minimos_cancelamento is
  'Antecedência mínima, em minutos, para um aviso de falta gerar crédito de '
  'reposição. 0 = qualquer aviso vale. Substitui horas_minimas_cancelamento, '
  'que era grossa demais para quem pede meia hora.';

comment on column conta.horas_minimas_cancelamento is
  'OBSOLETA desde a 0062: use minutos_minimos_cancelamento. Mantida só para o '
  'deploy não quebrar a versão anterior da aplicação; será derrubada.';

grant select, insert, update, delete on all tables in schema app_verandi to authenticated;
grant all on all tables in schema app_verandi to service_role;
