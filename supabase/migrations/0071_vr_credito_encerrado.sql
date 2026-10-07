-- Crédito de reposição encerrado fora do sistema.
--
-- A importação do histórico do MGM (planilhas de jan/2025 a out/2026) trouxe
-- cada falta como falta, e cada falta virou crédito de reposição em aberto: o
-- Rogério, com 2 reposições de verdade, apareceu com 7, e 62 alunos passaram
-- de 10. As reposições daquele período foram feitas e acertadas no papel.
--
-- A falta continua falta (é histórico de presença); o que se encerra é o
-- crédito. `credito_encerrado_em` diz quando e `credito_encerrado_motivo` diz
-- por quê, para quem abrir a ficha depois não achar que o sistema perdeu algo.

set search_path = app_verandi, extensions;

alter table participacao
  add column if not exists credito_encerrado_em timestamptz,
  add column if not exists credito_encerrado_motivo text;

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
      and pa.credito_encerrado_em is null
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
