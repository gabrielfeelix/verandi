-- Tudo aqui nasce em `app_verandi`. `public` fica fora do caminho de
-- propósito: é onde o AutoFluxos mora, e nome sem schema não pode cair lá por
-- acidente. Ver 0030.
set search_path = app_verandi, extensions;

/*
 * A porta do bot.
 *
 * O bot é do AutoFluxos, não da Verandi: ele conversa no WhatsApp e precisa
 * marcar aqui. Para isso ele se autentica com uma chave, e esta tabela é a
 * lista de chaves que cada conta emitiu. Ver `docs/planos/10-marco-2-api.md`.
 *
 * **A chave é da conta, não de quem a criou.** Parece detalhe e não é: se ela
 * pertencesse ao usuário, o dia em que a pessoa que ligou a integração sai da
 * empresa seria o dia em que o bot para de marcar aula, sem ninguém entender
 * por quê. Vínculo de pessoa se desliga em Usuários; integração se desliga em
 * Integrações.
 */
create table chave_api (
  id         uuid primary key default gen_random_uuid(),
  conta_id   uuid not null references conta(id) on delete cascade,

  /*
   * "AutoFluxos produção". Sem nome, revogar vira loteria: três chaves iguais
   * na tela e ninguém sabe qual está em uso.
   */
  nome       text not null check (length(btrim(nome)) between 1 and 60),

  /*
   * **SHA-256 do segredo, nunca o segredo.**
   *
   * Guardar token legível é a decisão que só dói depois de vazar, e aí não tem
   * volta: quem lê o banco passa a poder marcar e desmarcar aula na conta de
   * qualquer cliente. O segredo aparece uma vez, na criação, e some.
   *
   * `unique` porque o caminho de leitura é o inverso do normal: chega o
   * segredo, calcula-se o hash e procura-se a linha. Sem índice único isso é
   * varredura de tabela a cada chamada de API.
   */
  hash       text not null unique,

  /*
   * Os primeiros caracteres, em claro, para a tela dizer **qual** chave é sem
   * revelar o resto. É o que transforma "revogar" numa decisão em vez de um
   * chute, e o que deixa alguém achar a chave certa num log.
   */
  prefixo    text not null,

  /*
   * Responde "posso revogar esta?" sem adivinhação. Nulo é chave que nunca
   * chamou nada, que é exatamente a que se pode apagar sem medo.
   */
  ultimo_uso_em timestamptz,

  /*
   * Revogar **não apaga**. A linha fica, e com ela o nome e a data: sem isso,
   * "quem marcou esta aula?" passa a apontar para uma chave que não existe
   * mais, e o histórico perde o pé. Mesma régua de desativar serviço e local.
   */
  revogada_em   timestamptz,

  criada_por_usuario_id uuid references auth.users(id) on delete set null,
  criado_em  timestamptz not null default now()
);

create index chave_api_da_conta on chave_api (conta_id) where revogada_em is null;

alter table chave_api enable row level security;

/*
 * Só dono e suporte enxergam.
 *
 * Uma chave de API alcança a agenda inteira da conta, sem passar por papel: ela
 * é a credencial mais forte que um cliente emite. A recepção não precisa dela
 * para trabalhar, e o profissional muito menos. Mesma decisão do botão de
 * anonimizar pessoa, e pelo mesmo motivo.
 *
 * `hash` estar na tabela não é problema aqui: quem é dono já pode tudo na
 * própria conta. O que a política impede é a chave de uma conta aparecer para
 * outra, que é o isolamento que vale para todo o resto do banco.
 */
create policy chave_api_dono on chave_api for all
  using (app_verandi.tem_papel(conta_id, array['dono','suporte']::papel[]))
  with check (app_verandi.tem_papel(conta_id, array['dono','suporte']::papel[]));

/*
 * GRANT é camada separada de RLS: tabela criada por migration não recebe
 * privilégio sozinha, e sem isto até um `select` legítimo leva 42501. Se o erro
 * for 42501, olhe o grant antes da política.
 */
grant select, insert, update, delete on all tables in schema app_verandi to authenticated;
grant all on all tables in schema app_verandi to service_role;

/*
 * O log já sabia falar de configuração; agora sabe falar de integração também.
 * Criar e revogar chave são as duas coisas desta tela, e as duas precisam ficar
 * registradas com quem fez, pela mesma razão que "entrar como suporte" fica.
 *
 * `check` de texto é lista fechada por decisão, então cresce na mão.
 */
alter table log_configuracao
  drop constraint log_configuracao_entidade_check,
  add constraint log_configuracao_entidade_check check (entidade in
    ('serie','servico','profissional','local','vocabulario',
     'funcionamento','excecao_calendario','usuario_conta','convite','conta',
     'pessoa','chave_api'));
