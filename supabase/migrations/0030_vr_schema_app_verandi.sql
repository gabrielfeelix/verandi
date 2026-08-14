/*
 * A Verandi mora em `app_verandi`, não em `public`.
 *
 * O motivo é dinheiro, e está escrito para não virar mistério: enquanto não há
 * cliente pagante, o banco de produção é dividido com o AutoFluxos — o plano
 * gratuito do Supabase dá dois projetos por CONTA (não por organização), e os
 * dois já estão ocupados. Schema é a divisória: cada produto tem as suas
 * tabelas, as suas funções e as suas políticas, sem tabela compartilhada e sem
 * coluna dizendo "de quem é esta linha".
 *
 * A Verandi pode ser removida deste projeto com
 * `drop schema app_verandi cascade`, mais a limpeza explícita de Auth e
 * Storage. O caminho inverso ainda não é um simples
 * `drop schema app_autofluxos`: hoje o AutoFluxos mora em `public` e esse schema
 * não existe. Separá-lo exige primeiro migrar seus objetos para um schema
 * próprio ou extrair explicitamente o conjunto de objetos de `public`.
 *
 * Por isso nada da Verandi pode ficar em `public`: o que ficar lá não acompanha
 * `app_verandi` numa separação e ainda se mistura com o AutoFluxos.
 *
 * O que NÃO se separa por schema: `auth.users` é um só por projeto. Não vaza
 * dado (a RLS filtra por `usuario_conta`), mas na separação os dois projetos
 * herdam todos os usuários, e sobra apagar quem não tem vínculo.
 *
 * Exposto ao PostgREST pelo painel: API settings -> Exposed schemas. Isso não
 * tem API; se a tela do app responder "The schema must be one of the
 * following: public, storage", é esse passo que faltou.
 */

create schema if not exists app_verandi;

grant usage on schema app_verandi to anon, authenticated, service_role;

/*
 * Cada migration termina com o seu próprio bloco de grants — `grant on all
 * tables` só alcança o que já existe. O `alter default privileges` abaixo é o
 * cinto: pega o que for criado depois, inclusive fora de migration.
 */
alter default privileges for role postgres in schema app_verandi
  grant select, insert, update, delete on tables to authenticated;
alter default privileges for role postgres in schema app_verandi
  grant all on tables to service_role;
alter default privileges for role postgres in schema app_verandi
  grant execute on routines to authenticated, service_role;
alter default privileges for role postgres in schema app_verandi
  grant usage, select on sequences to authenticated, service_role;
