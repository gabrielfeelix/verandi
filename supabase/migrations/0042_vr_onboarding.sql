-- Tudo aqui nasce em `app_verandi`. `public` fica fora do caminho de
-- propósito: é onde o AutoFluxos mora, e nome sem schema não pode cair lá por
-- acidente. Ver 0030.
set search_path = app_verandi, extensions;

/*
 * O que cada pessoa já viu do onboarding.
 *
 * Três coisas precisam ser lembradas, e nenhuma delas cabe em `usuario_conta`:
 * aquilo é vínculo e papel, e progresso de tutorial faria a tabela de acesso
 * crescer pelo motivo errado.
 *
 *   - **Se já viu.** Por pessoa, não por conta: a recepcionista nova de um
 *     estúdio antigo precisa ver, e o dono não pode ver de novo.
 *   - **Onde parou.** Sequência interrompida que recomeça do zero é pior que
 *     sequência nenhuma.
 *   - **Se pulou.** Pular é resposta legítima e definitiva. Reoferecer é
 *     desrespeito com quem já disse não.
 *
 * A chave é `(usuario_id, conta_id, roteiro)` e não `(usuario_id, roteiro)`
 * porque o roteiro depende do papel, e o papel é por conta: a mesma pessoa é
 * dona de um estúdio e professora em outro, e ver o roteiro de dono não a
 * ensina a operar o segundo. `conta_id` também é o que deixa a RLS deste
 * produto continuar sendo a mesma de todas as outras tabelas.
 */
create table onboarding (
  id           uuid primary key default gen_random_uuid(),
  conta_id     uuid not null references conta(id) on delete cascade,
  usuario_id   uuid not null references auth.users(id) on delete cascade,
  -- qual sequência: 'boas-vindas' (o que é isto) ou 'primeiros-passos' (onde
  -- fica cada coisa). São separadas porque uma pode ser vista e a outra pulada
  roteiro      text not null check (roteiro in ('boas-vindas', 'primeiros-passos')),
  -- índice do passo em que a pessoa está, dentro do roteiro dela
  passo        smallint not null default 0 check (passo >= 0),
  concluido_em timestamptz,
  pulado_em    timestamptz,
  criado_em    timestamptz not null default now(),

  constraint onboarding_uk unique (usuario_id, conta_id, roteiro)
);

alter table onboarding enable row level security;

/*
 * Progresso de tutorial é da pessoa, e de mais ninguém.
 *
 * Nem o dono da conta lê o da recepção: saber que alguém pulou o tutorial não
 * ajuda a operar nada, e transformaria isto em placar de quem aprendeu o
 * sistema. A política é a mesma para ler e escrever.
 */
create policy onboarding_meu on onboarding for all
  using (usuario_id = auth.uid()
         and conta_id in (select app_verandi.contas_do_usuario()))
  with check (usuario_id = auth.uid()
              and conta_id in (select app_verandi.contas_do_usuario()));

/*
 * GRANT é camada separada de RLS: tabela criada por migration não recebe
 * privilégio sozinha, e sem isto até um `select` legítimo leva 42501. Se o erro
 * for 42501, olhe o grant antes da política.
 */
grant select, insert, update, delete on all tables in schema app_verandi to authenticated;
grant all on all tables in schema app_verandi to service_role;
