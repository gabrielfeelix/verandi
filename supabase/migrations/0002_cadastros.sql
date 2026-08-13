create table pessoa (
  id                    uuid primary key default gen_random_uuid(),
  conta_id              uuid not null references conta (id) on delete cascade,
  nome                  text not null,
  telefone              text,
  email                 text,
  identificador_externo text,
  nascimento            date,
  -- data que avisa, não valor que cobra: financeiro é outro produto
  vencimento_plano      date,
  observacao            text,
  ativo                 boolean not null default true,
  criado_em             timestamptz not null default now()
);
create index pessoa_conta_ix on pessoa (conta_id) where ativo;
create index pessoa_nome_ix  on pessoa (conta_id, lower(nome));

create table pessoa_tag (
  pessoa_id uuid not null references pessoa (id) on delete cascade,
  conta_id  uuid not null references conta (id) on delete cascade,
  tag       text not null,
  primary key (pessoa_id, tag)
);

create table profissional (
  id         uuid primary key default gen_random_uuid(),
  conta_id   uuid not null references conta (id) on delete cascade,
  nome       text not null,
  -- anulável de propósito: um nome na grade não precisa de acesso ao sistema
  usuario_id uuid references auth.users (id) on delete set null,
  cor        text,
  ativo      boolean not null default true
);
create index profissional_conta_ix on profissional (conta_id) where ativo;

create table servico (
  id                uuid primary key default gen_random_uuid(),
  conta_id          uuid not null references conta (id) on delete cascade,
  nome              text not null,
  duracao_min       integer not null default 60 check (duracao_min > 0),
  capacidade_padrao integer not null default 1 check (capacidade_padrao > 0),
  ativo             boolean not null default true
);

create table local (
  id       uuid primary key default gen_random_uuid(),
  conta_id uuid not null references conta (id) on delete cascade,
  nome     text not null,
  ativo    boolean not null default true
);

-- RLS: leitura para quem é da conta, escrita para dono, recepção e suporte.
-- `profissional` não escreve cadastro; ele registra presença (migration 0003).
do $$
declare t text;
begin
  foreach t in array array['pessoa','pessoa_tag','profissional','servico','local']
  loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy %I_le on %I for select using (conta_id in (select public.contas_do_usuario()))',
      t, t);
    execute format(
      'create policy %I_escreve on %I for all
         using (public.tem_papel(conta_id, array[''dono'',''recepcao'',''suporte'']::papel[]))
         with check (public.tem_papel(conta_id, array[''dono'',''recepcao'',''suporte'']::papel[]))',
      t, t);
  end loop;
end $$;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
