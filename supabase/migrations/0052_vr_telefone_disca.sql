-- Tudo aqui nasce em `app_verandi`. `public` fica fora do caminho de
-- propósito: é onde o AutoFluxos mora, e nome sem schema não pode cair lá por
-- acidente. Ver 0030.
set search_path = app_verandi, extensions;

/*
 * "Tem telefone" e "dá para avisar" não são a mesma pergunta.
 *
 * A base veio de planilha onde o número é anotado como se fala na recepção:
 * "9.8109-1840", sem DDD, porque quem anota e quem liga moram na mesma cidade.
 * No sistema isso não avisa ninguém — o WhatsApp precisa de país e DDD —, e a
 * lista de "sem telefone", que é por onde a recepção corre atrás do cadastro
 * incompleto, dava esses como resolvidos.
 *
 * Coluna gerada, e não consulta com `regexp_replace` na tela: o PostgREST só
 * filtra por coluna, e sem isto a pergunta teria que virar uma função ou um
 * filtro feito em memória depois de trazer a conta inteira.
 */
alter table pessoa
  add column if not exists telefone_disca boolean
    generated always as (
      length(regexp_replace(coalesce(telefone, ''), '\D', '', 'g')) >= 10
    ) stored;

comment on column pessoa.telefone_disca is
  'o telefone tem DDD e dá para mandar mensagem; ver 0052';

create index if not exists pessoa_telefone_incompleto_ix
  on pessoa (conta_id) where ativo and not telefone_disca;

/*
 * A view é lista de colunas: coluna nova só chega à tela quando ela é
 * reescrita, e `create or replace` só aceita acréscimo no fim. Ver `0051`.
 */
create or replace view pessoa_resumo with (security_invoker = true) as
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
  p.observacao_visivel,
  p.ativo,
  p.anonimizada_em,
  p.criado_em,
  (select count(*)
     from vaga v
    where v.pessoa_id = p.id
      and (v.fim is null or v.fim >= current_date)) as vagas_ativas,
  -- falta é falta: dia que o negócio fechou não entra aqui, senão a leitura
  -- "está sumindo" acusa quem não faltou
  (select count(*)
     from participacao pa
     join sessao s on s.id = pa.sessao_id
    where pa.pessoa_id = p.id
      and pa.status in ('falta', 'falta_avisada')
      and s.inicio >= now() - interval '30 days') as faltas_recentes,
  -- o que gerou crédito e ninguém usou ainda, incluindo o dia cancelado
  (select count(*)
     from participacao pa
    where pa.pessoa_id = p.id
      and pa.status in ('falta', 'falta_avisada', 'cancelada')
      and not exists (select 1 from participacao r where r.reposicao_de_id = pa.id)
  ) as reposicoes_abertas,
  (select max(s.inicio)
     from participacao pa
     join sessao s on s.id = pa.sessao_id
    where pa.pessoa_id = p.id
      and pa.status = 'presente') as ultima_presenca,
  p.foto_path,
  p.telefone_disca
from pessoa p;

grant select on pessoa_resumo to authenticated, service_role;

grant select, insert, update, delete on all tables in schema app_verandi to authenticated;
grant all on all tables in schema app_verandi to service_role;
