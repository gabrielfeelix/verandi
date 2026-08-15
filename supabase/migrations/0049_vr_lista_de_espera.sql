-- Tudo aqui nasce em `app_verandi`. `public` fica fora do caminho de
-- propósito: é onde o AutoFluxos mora, e nome sem schema não pode cair lá por
-- acidente. Ver 0030.
set search_path = app_verandi, extensions;

/*
 * "Não tem vaga" vira "te aviso se abrir".
 *
 * Hoje a conversa acaba no não. O horário está cheio, o bot não oferece, e a
 * pessoa vai procurar outro estúdio. A lista de espera é o que transforma a
 * recusa em promessa, e ela só faz sentido depois da 0048: é o evento de
 * cancelamento que dispara a chamada da próxima.
 *
 * **A espera é de um horário, não de um dia.** Guardar "quero qualquer coisa na
 * terça" parece mais flexível e é pior: quando abre vaga, ninguém sabe se
 * aquela é a que a pessoa queria, e o aviso vira spam. Quem quer duas
 * possibilidades entra em duas listas, e isso é resposta clara.
 */
create table espera (
  id        uuid primary key default gen_random_uuid(),
  conta_id  uuid not null references conta (id) on delete cascade,
  sessao_id uuid not null references sessao (id) on delete cascade,
  pessoa_id uuid not null references pessoa (id) on delete cascade,

  /*
   * A ordem da fila é a ordem de chegada, e é isto que a define. Sem coluna de
   * posição de propósito: posição guardada precisa ser reescrita quando alguém
   * sai do meio, e fila com número desencontrado é a discussão que o estúdio vai
   * ter com o cliente.
   */
  criado_em timestamptz not null default now(),

  /*
   * Quando a vaga abriu e a pessoa foi chamada. Não é "resolvido": ela pode não
   * responder, e o registro precisa saber a diferença entre "ninguém avisou" e
   * "avisamos e ela não veio".
   */
  avisado_em   timestamptz,
  /* saiu da fila, por desistência ou porque marcou em outro horário */
  cancelado_em timestamptz
);

/*
 * Uma pessoa não entra duas vezes na mesma fila. Sem isto, o bot que repete a
 * chamada por reentrega põe a mesma pessoa três vezes na espera, e ela recebe
 * três mensagens quando a vaga abrir.
 */
create unique index espera_uk on espera (sessao_id, pessoa_id)
  where cancelado_em is null;

/* a consulta do entregador: quem está esperando por este horário, em ordem */
create index espera_da_sessao on espera (sessao_id, criado_em)
  where cancelado_em is null and avisado_em is null;

create index espera_da_conta on espera (conta_id, criado_em desc);

comment on table espera is
  'quem quer ser avisado quando abrir vaga em um horário cheio. A ordem é a de '
  'chegada, e não há coluna de posição de propósito';

alter table espera enable row level security;

/*
 * Leitura para quem é da conta, escrita para quem opera. É dado de conta como
 * qualquer outro: a recepção precisa ver a fila para atender quem liga
 * perguntando, e o profissional precisa saber que a turma tem gente esperando.
 */
create policy espera_le on espera for select
  using (conta_id in (select app_verandi.contas_do_usuario()));

create policy espera_escreve on espera for all
  using (app_verandi.tem_papel(conta_id, array['dono','recepcao','suporte']::papel[]))
  with check (app_verandi.tem_papel(conta_id, array['dono','recepcao','suporte']::papel[]));

/*
 * O evento novo. `vaga.aberta` é o que fecha o ciclo: alguém cancelou, a vaga
 * existe de novo, e quem está esperando precisa saber antes que a recepção
 * preencha com outra pessoa.
 */
alter table evento_saida
  drop constraint evento_saida_tipo_check,
  add constraint evento_saida_tipo_check check (tipo in
    ('participacao.criada', 'participacao.cancelada', 'sessao.cancelada',
     'vaga.aberta'));

/*
 * GRANT é camada separada de RLS: tabela criada por migration não recebe
 * privilégio sozinha, e sem isto até um `select` legítimo leva 42501.
 */
grant select, insert, update, delete on all tables in schema app_verandi to authenticated;
grant all on all tables in schema app_verandi to service_role;

/* e o cadeado das duas tabelas da 0048 continua de pé depois do grant acima */
revoke all on evento_saida from anon, authenticated;
revoke all on webhook from anon, authenticated;
