/*
 * Quem mexeu na configuração.
 *
 * "Toda ação registra quem fez" já valia para presença desde o Plano 01, e não
 * valia para configuração: quem baixou a capacidade da turma, quem desativou o
 * serviço, quem mexeu no vocabulário — nada disso ficava. Ninguém sente falta
 * até a primeira conversa "eu não mudei isso".
 *
 * Uma tabela só, em vez de colunas de auditoria em cinco tabelas: entidade nova
 * não pede migration, e a consulta "o que aconteceu nesta conta" é uma só.
 */
create table log_configuracao (
  id             uuid primary key default gen_random_uuid(),
  conta_id       uuid not null references conta (id) on delete cascade,
  entidade       text not null check (entidade in
                   ('serie','servico','profissional','local','vocabulario',
                    'funcionamento','excecao_calendario','usuario_conta','convite','conta')),
  entidade_id    uuid,
  acao           text not null check (acao in
                   ('criou','editou','duplicou','encerrou','desativou','reativou','removeu')),
  -- o que mudou, em texto que serve para ler: nunca o dado inteiro
  detalhe        jsonb not null default '{}'::jsonb,
  por_usuario_id uuid references auth.users (id) on delete set null,
  em             timestamptz not null default now()
);

create index log_configuracao_conta_ix on log_configuracao (conta_id, em desc);

alter table log_configuracao enable row level security;

create policy log_configuracao_le on log_configuracao for select
  using (conta_id in (select public.contas_do_usuario()));

/*
 * Só insert, e só no próprio nome. Não existe política de update nem de delete:
 * log que o autor reescreve não é log — é rascunho.
 */
create policy log_configuracao_escreve on log_configuracao for insert
  with check (public.tem_papel(conta_id, array['dono','recepcao','suporte']::papel[])
              and por_usuario_id = auth.uid());

grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
