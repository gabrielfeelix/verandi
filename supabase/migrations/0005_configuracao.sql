/*
 * O que falta para uma conta nascer e se configurar sozinha: convidar gente,
 * dizer quando o negócio abre, dar baixa em pendência, e registrar quando a
 * 4YU entra numa conta de cliente.
 *
 * Nenhuma tabela aqui guarda estado derivado. Pendência não é coluna — é
 * consulta; o que se grava é o ato de dispensar.
 */

-- ---------------------------------------------------------------------------
-- Convite
-- ---------------------------------------------------------------------------

/*
 * O token vive fora do banco: aqui fica só o sha256 dele, e a tela mostra o
 * valor em claro uma vez só. Guardar token legível é decisão que só dói depois
 * de vazar — quem lê o banco passa a poder entrar em qualquer conta.
 *
 * `revogado_em` em vez de `delete`: quem revogou e quando é a informação que
 * responde "por que a Sofia não conseguiu entrar", e ela some com a linha.
 */
create table convite (
  id                    uuid primary key default gen_random_uuid(),
  conta_id              uuid not null references conta (id) on delete cascade,
  email                 text not null,
  papel                 papel not null,
  token_hash            text not null unique,
  criado_por_usuario_id uuid references auth.users (id) on delete set null,
  criado_em             timestamptz not null default now(),
  expira_em             timestamptz not null,
  aceito_em             timestamptz,
  aceito_por_usuario_id uuid references auth.users (id) on delete set null,
  revogado_em           timestamptz,
  check (aceito_em is null or revogado_em is null)
);

-- um convite pendente por e-mail em cada conta; aceito e revogado não estorvam,
-- porque convidar de novo depois de revogar é caminho normal
create unique index convite_pendente_uk on convite (conta_id, lower(email))
  where aceito_em is null and revogado_em is null;

create index convite_conta_ix on convite (conta_id);

-- ---------------------------------------------------------------------------
-- Funcionamento
-- ---------------------------------------------------------------------------

/*
 * Quando o negócio abre. Serve para o editor de série sugerir faixa e para a
 * busca de vaga não oferecer 3h da manhã.
 *
 * Um intervalo por dia da semana, e dia ausente significa fechado — em vez de
 * uma coluna `aberto` que pode discordar do horário.
 */
create table funcionamento (
  conta_id   uuid not null references conta (id) on delete cascade,
  dia_semana smallint not null check (dia_semana between 0 and 6),
  abre       time not null,
  fecha      time not null,
  primary key (conta_id, dia_semana),
  check (fecha > abre)
);

-- ---------------------------------------------------------------------------
-- Pendência dispensada
-- ---------------------------------------------------------------------------

/*
 * Pendência é derivada — cada grupo da tela é uma consulta sobre o dado que já
 * existe. O que se grava é o ato de dispensar, com motivo e com quem fez.
 *
 * A lista precisa ser esvaziável: pendência que nunca zera vira ruído, e a
 * pessoa para de abrir a tela.
 *
 * `referencia_id` não tem FK: ele aponta para tabelas diferentes conforme o
 * tipo (sessão, participação, pessoa). A limpeza vem por `conta_id`.
 */
create table pendencia_dispensada (
  id                        uuid primary key default gen_random_uuid(),
  conta_id                  uuid not null references conta (id) on delete cascade,
  tipo                      text not null check (tipo in
                              ('chamada_nao_feita','reposicao_aberta','reserva_esperando',
                               'plano_vencendo','cadastro_incompleto')),
  referencia_id             uuid not null,
  motivo                    text not null,
  dispensado_por_usuario_id uuid references auth.users (id) on delete set null,
  dispensado_em             timestamptz not null default now(),
  unique (conta_id, tipo, referencia_id)
);

-- ---------------------------------------------------------------------------
-- Acesso de suporte
-- ---------------------------------------------------------------------------

/*
 * Quando a 4YU entra numa conta de cliente, fica registrado. Ver dado de
 * cliente sem que ninguém saiba é o tipo de acesso que precisa ser
 * constrangedor de propósito — a faixa na tela é a parte visível, esta tabela é
 * a parte que sobra depois.
 */
create table acesso_suporte (
  id          uuid primary key default gen_random_uuid(),
  conta_id    uuid not null references conta (id) on delete cascade,
  usuario_id  uuid not null references auth.users (id) on delete cascade,
  iniciado_em timestamptz not null default now(),
  encerrado_em timestamptz,
  check (encerrado_em is null or encerrado_em >= iniciado_em)
);

create index acesso_suporte_conta_ix on acesso_suporte (conta_id, iniciado_em desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

/*
 * Leitura para quem é da conta; escrita conforme quem manda em cada coisa.
 *
 * `convite` NÃO tem política de leitura anônima. Aceitar um convite exige criar
 * usuário no Auth, o que já é trabalho de chave de serviço — então o fluxo
 * inteiro roda no servidor, com o token fazendo o papel da credencial. Abrir a
 * tabela para `anon` daria a quem sabe o formato do hash uma janela para
 * enumerar convite de qualquer conta.
 */
do $$
declare t text;
begin
  foreach t in array array['convite','funcionamento','pendencia_dispensada','acesso_suporte']
  loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy %I_le on %I for select using (conta_id in (select public.contas_do_usuario()))',
      t, t);
  end loop;
end $$;

-- convidar e revogar é de quem manda na conta
create policy convite_escreve on convite for all
  using (public.tem_papel(conta_id, array['dono','suporte']::papel[]))
  with check (public.tem_papel(conta_id, array['dono','suporte']::papel[]));

create policy funcionamento_escreve on funcionamento for all
  using (public.tem_papel(conta_id, array['dono','suporte']::papel[]))
  with check (public.tem_papel(conta_id, array['dono','suporte']::papel[]));

-- recepção entra aqui: é quem opera a tela de pendências
create policy pendencia_dispensada_escreve on pendencia_dispensada for all
  using (public.tem_papel(conta_id, array['dono','recepcao','suporte']::papel[]))
  with check (public.tem_papel(conta_id, array['dono','recepcao','suporte']::papel[]));

-- só a 4YU escreve o próprio log, e ninguém apaga o que já foi escrito
create policy acesso_suporte_escreve on acesso_suporte for insert
  with check (public.tem_papel(conta_id, array['suporte']::papel[])
              and usuario_id = auth.uid());

create policy acesso_suporte_encerra on acesso_suporte for update
  using (public.tem_papel(conta_id, array['suporte']::papel[]) and usuario_id = auth.uid())
  with check (public.tem_papel(conta_id, array['suporte']::papel[]) and usuario_id = auth.uid());

/*
 * GRANT é camada separada de RLS: tabela criada por migration não recebe
 * privilégio sozinha, e sem isto até a chave de serviço leva 42501. Se o erro
 * for 42501, olhe o grant antes de olhar a política.
 */
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
