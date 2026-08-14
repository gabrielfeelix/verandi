-- Tudo aqui nasce em `app_verandi`. `public` fica fora do caminho de
-- propósito: é onde o AutoFluxos mora, e nome sem schema não pode cair lá por
-- acidente. Ver 0030.
set search_path = app_verandi, extensions;

/*
 * O que aconteceu com o e-mail do convite depois que ele saiu.
 *
 * Sem isto, bounce é invisível: a dona convida `maria@gmial.com` com o erro de
 * digitação, a tela diz "Convite enviado", o e-mail volta, e ninguém fica
 * sabendo até virar chamado para a 4YU. Quem conta é o webhook do Brevo — é a
 * única coisa que ele sabe e o nosso banco não.
 *
 * `null` quer dizer "ainda não veio notícia", que é diferente de "deu certo".
 * A tela precisa distinguir os dois: afirmar entrega que não se confirmou é o
 * defeito que esta coluna existe para corrigir.
 */
alter table convite
  add column entrega    text,
  add column entrega_em timestamptz;

alter table convite
  add constraint convite_entrega_ck
  check (entrega is null or entrega in ('entregue', 'voltou', 'spam', 'bloqueado'));

/*
 * O webhook chega sem sessão e sem saber de conta: ele traz um e-mail e um
 * evento. Quem cruza isso com a linha certa é o servidor, com a chave de
 * serviço — por isso não há política nova aqui. As de `convite` já cobrem quem
 * lê pela tela.
 */
create index convite_email_ix on convite (lower(email));

grant select, insert, update, delete on all tables in schema app_verandi to authenticated;
grant all on all tables in schema app_verandi to service_role;
