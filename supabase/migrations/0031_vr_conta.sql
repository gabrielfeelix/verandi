-- Tudo aqui nasce em `app_verandi`. `public` fica fora do caminho de
-- propósito: é onde o AutoFluxos mora, e nome sem schema não pode cair lá por
-- acidente. Ver 0030.
set search_path = app_verandi, extensions;

create extension if not exists pgcrypto with schema extensions;

create type papel as enum ('dono', 'recepcao', 'profissional', 'suporte');

create table conta (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null,
  slug      text not null unique,
  fuso      text not null default 'America/Sao_Paulo',
  ativo     boolean not null default true,
  criado_em timestamptz not null default now()
);

create table usuario_conta (
  usuario_id uuid not null references auth.users (id) on delete cascade,
  conta_id   uuid not null references conta (id) on delete cascade,
  papel      papel not null,
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now(),
  primary key (usuario_id, conta_id)
);

create table vocabulario (
  conta_id uuid not null references conta (id) on delete cascade,
  chave    text not null check (chave in
             ('pessoa','profissional','servico','local','serie','sessao','vaga')),
  singular text not null,
  plural   text not null,
  primary key (conta_id, chave)
);

-- security definer para não cair em recursão: a política de `pessoa` consulta
-- `usuario_conta`, que também tem RLS. A função roda com os direitos do dono e
-- corta o laço. `search_path` fixo é obrigatório em security definer.
create or replace function app_verandi.contas_do_usuario()
returns setof uuid
language sql
stable
security definer
set search_path = app_verandi, auth
as $$
  select conta_id from app_verandi.usuario_conta
   where usuario_id = auth.uid() and ativo
$$;

create or replace function app_verandi.tem_papel(p_conta uuid, p_papeis papel[])
returns boolean
language sql
stable
security definer
set search_path = app_verandi, auth
as $$
  select exists (
    select 1 from app_verandi.usuario_conta
     where usuario_id = auth.uid()
       and conta_id = p_conta
       and ativo
       and papel = any (p_papeis)
  )
$$;

alter table conta          enable row level security;
alter table usuario_conta  enable row level security;
alter table vocabulario    enable row level security;

create policy conta_le on conta
  for select using (id in (select app_verandi.contas_do_usuario()));

create policy conta_escreve on conta
  for update using (app_verandi.tem_papel(id, array['dono','suporte']::papel[]))
           with check (app_verandi.tem_papel(id, array['dono','suporte']::papel[]));

create policy usuario_conta_le on usuario_conta
  for select using (usuario_id = auth.uid() or
                    app_verandi.tem_papel(conta_id, array['dono','suporte']::papel[]));

create policy usuario_conta_escreve on usuario_conta
  for all using (app_verandi.tem_papel(conta_id, array['dono','suporte']::papel[]))
      with check (app_verandi.tem_papel(conta_id, array['dono','suporte']::papel[]));

create policy vocabulario_le on vocabulario
  for select using (conta_id in (select app_verandi.contas_do_usuario()));

create policy vocabulario_escreve on vocabulario
  for all using (app_verandi.tem_papel(conta_id, array['dono','suporte']::papel[]))
      with check (app_verandi.tem_papel(conta_id, array['dono','suporte']::papel[]));

-- Tabela criada por migration não ganha privilégio sozinha: sem isto, até a
-- chave de serviço leva `42501 permission denied`. RLS decide QUAIS linhas;
-- o GRANT decide se a role pode falar com a tabela. São camadas diferentes e
-- as duas precisam existir.
--
-- `anon` fica de fora de propósito: sem `auth.uid()` ela não passaria por
-- política nenhuma, e não conceder é mais barato que confiar que não passa.
grant usage on schema app_verandi to authenticated, service_role;
grant select, insert, update, delete on all tables in schema app_verandi to authenticated;
grant all on all tables in schema app_verandi to service_role;
grant execute on all functions in schema app_verandi to authenticated, service_role;
