-- Tudo aqui nasce em `app_verandi`. `public` fica fora do caminho de
-- propósito: é onde o AutoFluxos mora, e nome sem schema não pode cair lá por
-- acidente. Ver 0030.
set search_path = app_verandi, extensions;

/*
 * A equipe: contato, foto e quais serviços cada um atende.
 *
 * `profissional` continua podendo existir sem usuário — um nome na grade não
 * precisa de acesso ao sistema, e essa é a diferença entre "quem atende" e
 * "quem usa o sistema" que o produto sustenta desde a primeira migration.
 */

alter table profissional
  add column email    text,
  add column telefone text,
  -- o caminho dentro do balde, não a URL: URL assinada expira, caminho não
  add column foto_path text;

/*
 * Quais serviços cada profissional atende.
 *
 * Filtra o seletor ao montar a grade, para não escalar quem dá boxe numa turma
 * de pilates. Sem linha nenhuma significa "atende todos" — conta nova não
 * precisa preencher isto para funcionar.
 */
create table profissional_servico (
  conta_id        uuid not null references conta (id) on delete cascade,
  profissional_id uuid not null references profissional (id) on delete cascade,
  servico_id      uuid not null references servico (id) on delete cascade,
  primary key (profissional_id, servico_id)
);

create index profissional_servico_conta_ix on profissional_servico (conta_id);

alter table profissional_servico enable row level security;

create policy profissional_servico_le on profissional_servico for select
  using (conta_id in (select app_verandi.contas_do_usuario()));

create policy profissional_servico_escreve on profissional_servico for all
  using (app_verandi.tem_papel(conta_id, array['dono','suporte']::papel[]))
  with check (app_verandi.tem_papel(conta_id, array['dono','suporte']::papel[]));

-- ---------------------------------------------------------------------------
-- Foto
-- ---------------------------------------------------------------------------

/*
 * Balde **privado**.
 *
 * Foto de funcionário é dado pessoal de gente que não escolheu estar num
 * sistema — quem cadastra é o estúdio. Balde público seria uma URL que vaza uma
 * vez e vale para sempre; aqui a tela pede uma URL assinada de vida curta a cada
 * carregamento.
 *
 * O caminho é `<conta_id>/<profissional_id>.<ext>`: a primeira pasta é a conta,
 * e é por ela que a política separa um cliente do outro.
 */
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'foto-profissional', 'foto-profissional', false, 2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy foto_profissional_le on storage.objects for select
  using (
    bucket_id = 'foto-profissional'
    and ((storage.foldername(name))[1])::uuid in (select app_verandi.contas_do_usuario())
  );

create policy foto_profissional_escreve on storage.objects for insert
  with check (
    bucket_id = 'foto-profissional'
    and app_verandi.tem_papel(((storage.foldername(name))[1])::uuid,
                         array['dono','suporte']::papel[])
  );

create policy foto_profissional_atualiza on storage.objects for update
  using (
    bucket_id = 'foto-profissional'
    and app_verandi.tem_papel(((storage.foldername(name))[1])::uuid,
                         array['dono','suporte']::papel[])
  );

create policy foto_profissional_apaga on storage.objects for delete
  using (
    bucket_id = 'foto-profissional'
    and app_verandi.tem_papel(((storage.foldername(name))[1])::uuid,
                         array['dono','suporte']::papel[])
  );

grant select, insert, update, delete on all tables in schema app_verandi to authenticated;
grant all on all tables in schema app_verandi to service_role;
