-- Tudo aqui nasce em `app_verandi`. `public` fica fora do caminho de
-- propósito: é onde o AutoFluxos mora, e nome sem schema não pode cair lá por
-- acidente. Ver 0030.
set search_path = app_verandi, extensions;

create type status_sessao       as enum ('prevista', 'realizada', 'cancelada');
create type origem_participacao as enum ('recorrente','avulso','reposicao','encaixe','reserva');
create type status_participacao as enum ('esperada','confirmada','presente',
                                         'falta','falta_avisada','licenca','cancelada');
create type origem_registro     as enum ('profissional','recepcao','bot','sistema','importacao');

create table serie (
  id              uuid primary key default gen_random_uuid(),
  conta_id        uuid not null references conta (id) on delete cascade,
  servico_id      uuid not null references servico (id),
  profissional_id uuid references profissional (id),
  local_id        uuid references local (id),
  dia_semana      smallint not null check (dia_semana between 0 and 6),
  hora_inicio     time not null,
  duracao_min     integer not null check (duracao_min > 0),
  capacidade      integer not null check (capacidade > 0),
  vigencia_inicio date not null,
  vigencia_fim    date,
  ativo           boolean not null default true,
  criado_em       timestamptz not null default now(),
  check (vigencia_fim is null or vigencia_fim >= vigencia_inicio)
);
create index serie_conta_dia_ix on serie (conta_id, dia_semana) where ativo;

-- a reserva permanente de uma pessoa numa série (a "matrícula").
-- tem vigência porque quem sai do horário das 7h em agosto não pode
-- desaparecer do histórico de março.
create table vaga (
  id        uuid primary key default gen_random_uuid(),
  conta_id  uuid not null references conta (id) on delete cascade,
  serie_id  uuid not null references serie (id) on delete cascade,
  pessoa_id uuid not null references pessoa (id) on delete cascade,
  inicio    date not null,
  fim       date,
  criado_em timestamptz not null default now(),
  check (fim is null or fim >= inicio)
);
create index vaga_serie_ix on vaga (serie_id);

create table sessao (
  id                  uuid primary key default gen_random_uuid(),
  conta_id            uuid not null references conta (id) on delete cascade,
  serie_id            uuid references serie (id) on delete set null,
  -- cópia, não referência viva: editar a série não reescreve o passado.
  -- é também o que permite o profissional subir a capacidade de UM dia.
  servico_id          uuid not null references servico (id),
  profissional_id     uuid references profissional (id),
  local_id            uuid references local (id),
  inicio              timestamptz not null,
  duracao_min         integer not null check (duracao_min > 0),
  capacidade          integer not null check (capacidade > 0),
  status              status_sessao not null default 'prevista',
  motivo_cancelamento text,
  criado_em           timestamptz not null default now()
);

-- o que torna a materialização sob demanda segura contra corrida.
--
-- Não é índice parcial de propósito. Um `where serie_id is not null` diria a
-- mesma coisa, mas `ON CONFLICT` só usa índice parcial se o predicado for
-- repetido na consulta — e o PostgREST não tem como mandar predicado, então o
-- upsert quebraria com "no unique or exclusion constraint matching".
--
-- A constraint simples já basta porque no Postgres nulos são distintos entre
-- si (NULLS DISTINCT é o padrão): duas sessões avulsas no mesmo instante, com
-- `serie_id` nulo, continuam permitidas — e elas são legítimas, porque são
-- dois profissionais ou duas salas.
alter table sessao add constraint sessao_serie_inicio_uk unique (serie_id, inicio);
create index sessao_conta_inicio_ix on sessao (conta_id, inicio);

create table participacao (
  id                        uuid primary key default gen_random_uuid(),
  conta_id                  uuid not null references conta (id) on delete cascade,
  sessao_id                 uuid not null references sessao (id) on delete cascade,
  pessoa_id                 uuid not null references pessoa (id) on delete cascade,
  origem                    origem_participacao not null,
  status                    status_participacao not null default 'esperada',
  -- o `REP 05/6` escrito à mão na planilha vira chave estrangeira
  reposicao_de_id           uuid references participacao (id) on delete set null,
  observacao                text,
  registrado_por_usuario_id uuid references auth.users (id) on delete set null,
  registrado_por_origem     origem_registro not null default 'sistema',
  registrado_em             timestamptz not null default now()
);

-- a única regra que o BANCO impõe. Lotação é regra de aplicação, não de
-- constraint: gatilho contando participação quebraria a importação do
-- histórico, onde sessões de fato tiveram mais gente que a capacidade nominal.
create unique index participacao_sessao_pessoa_uk
  on participacao (sessao_id, pessoa_id);
create index participacao_sessao_ix on participacao (sessao_id);
create index participacao_pessoa_ix on participacao (pessoa_id);
-- as reposições em aberto da tela de Pendências saem daqui
create index participacao_falta_aberta_ix on participacao (conta_id, pessoa_id)
  where status in ('falta', 'falta_avisada');

create table excecao_calendario (
  id        uuid primary key default gen_random_uuid(),
  conta_id  uuid not null references conta (id) on delete cascade,
  data      date not null,
  tipo      text not null check (tipo in ('feriado', 'fechado')),
  descricao text,
  unique (conta_id, data)
);

do $$
declare t text;
begin
  foreach t in array array['serie','vaga','sessao','participacao','excecao_calendario']
  loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy %I_le on %I for select using (conta_id in (select app_verandi.contas_do_usuario()))',
      t, t);
  end loop;
end $$;

-- escrita de estrutura: dono, recepção, suporte
create policy serie_escreve on serie for all
  using (app_verandi.tem_papel(conta_id, array['dono','recepcao','suporte']::papel[]))
  with check (app_verandi.tem_papel(conta_id, array['dono','recepcao','suporte']::papel[]));

create policy vaga_escreve on vaga for all
  using (app_verandi.tem_papel(conta_id, array['dono','recepcao','suporte']::papel[]))
  with check (app_verandi.tem_papel(conta_id, array['dono','recepcao','suporte']::papel[]));

create policy excecao_escreve on excecao_calendario for all
  using (app_verandi.tem_papel(conta_id, array['dono','suporte']::papel[]))
  with check (app_verandi.tem_papel(conta_id, array['dono','suporte']::papel[]));

-- escrita de operação: o profissional entra aqui, porque é ele quem faz chamada
create policy sessao_escreve on sessao for all
  using (app_verandi.tem_papel(conta_id, array['dono','recepcao','profissional','suporte']::papel[]))
  with check (app_verandi.tem_papel(conta_id, array['dono','recepcao','profissional','suporte']::papel[]));

create policy participacao_escreve on participacao for all
  using (app_verandi.tem_papel(conta_id, array['dono','recepcao','profissional','suporte']::papel[]))
  with check (app_verandi.tem_papel(conta_id, array['dono','recepcao','profissional','suporte']::papel[]));

grant select, insert, update, delete on all tables in schema app_verandi to authenticated;
grant all on all tables in schema app_verandi to service_role;
