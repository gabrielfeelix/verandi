-- Tudo aqui nasce em `app_verandi`. `public` fica fora do caminho de
-- propósito: é onde o AutoFluxos mora, e nome sem schema não pode cair lá por
-- acidente. Ver 0030.
set search_path = app_verandi, extensions;

create extension if not exists unaccent with schema extensions;

-- `unaccent()` de um argumento é STABLE, e coluna gerada exige IMMUTABLE.
-- A forma de dois argumentos fixa o dicionário, o que torna o resultado
-- determinístico de verdade — é o motivo de dar para marcar immutable aqui.
create or replace function app_verandi.sem_acento(t text)
returns text
language sql
immutable
strict
parallel safe
set search_path = app_verandi, extensions
as $$ select lower(unaccent('unaccent', t)) $$;

-- Coluna gerada em vez de função no filtro: o PostgREST não chama função em
-- `where`, e no dado real a mesma pessoa aparece escrita de formas diferentes
-- entre meses. Buscar "emilia" tem que achar "Emília".
alter table pessoa
  add column nome_busca text generated always as (app_verandi.sem_acento(nome)) stored;

create index pessoa_nome_busca_ix on pessoa (conta_id, nome_busca text_pattern_ops);

/*
 * Os recortes que a planilha não dá: quem está sumindo, quem eu não consigo
 * avisar, quem tem crédito de reposição parado.
 *
 * `security_invoker` é obrigatório: sem ele a view roda com os direitos de
 * quem a criou e passa por cima da RLS, vazando pessoa entre contas.
 */
create view pessoa_resumo with (security_invoker = true) as
select
  p.id,
  p.conta_id,
  p.nome,
  p.nome_busca,
  p.telefone,
  p.email,
  p.identificador_externo,
  p.nascimento,
  p.vencimento_plano,
  p.observacao,
  p.ativo,
  p.criado_em,
  (select count(*)
     from vaga v
    where v.pessoa_id = p.id
      and (v.fim is null or v.fim >= current_date)) as vagas_ativas,
  (select count(*)
     from participacao pa
     join sessao s on s.id = pa.sessao_id
    where pa.pessoa_id = p.id
      and pa.status in ('falta', 'falta_avisada')
      and s.inicio >= now() - interval '30 days') as faltas_recentes,
  -- falta que gerou crédito e ninguém usou ainda
  (select count(*)
     from participacao pa
    where pa.pessoa_id = p.id
      and pa.status in ('falta', 'falta_avisada')
      and not exists (select 1 from participacao r where r.reposicao_de_id = pa.id)
  ) as reposicoes_abertas,
  (select max(s.inicio)
     from participacao pa
     join sessao s on s.id = pa.sessao_id
    where pa.pessoa_id = p.id
      and pa.status = 'presente') as ultima_presenca
from pessoa p;

grant select on pessoa_resumo to authenticated, service_role;
grant execute on function app_verandi.sem_acento(text) to authenticated, service_role;
