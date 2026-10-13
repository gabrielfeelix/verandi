-- Falta sem aviso gera crédito? Agora a conta decide.
--
-- Até aqui toda falta virava reposição em aberto. Na MGM só a falta
-- justificada dá direito a repor: quem falta sem avisar perde a aula. A ficha
-- da Ana Maria Pasqualin mostrava 16 reposições, 6 delas de falta sem aviso
-- (Daniel, 13/10/2026).
--
-- `credito_falta` nasce `true`, que é como o produto se comportou até hoje.
-- Desligar não apaga nada: as faltas continuam faltas, só deixam de contar
-- como crédito, e religar devolve todas. É par de `credito_falta_avisada`
-- (0037), que responde a mesma pergunta para quem avisou.

set search_path = app_verandi, extensions;

alter table conta
  add column if not exists credito_falta boolean not null default true;

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
      -- falta sem aviso só conta se a conta der crédito para ela
      and (pa.status <> 'falta'
           or (select c.credito_falta from conta c where c.id = p.conta_id))
      and pa.credito_encerrado_em is null
      -- a aula que é reposição de outra não abre crédito próprio
      and pa.reposicao_de_id is null
      -- reposição em que a pessoa faltou não pagou a falta
      and not exists (select 1 from participacao r
                       where r.reposicao_de_id = pa.id
                         and r.status not in ('falta', 'falta_avisada', 'cancelada', 'licenca'))
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
