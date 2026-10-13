-- Falta na reposição não é reposição feita.
--
-- A aula de reposição em que a pessoa faltou contava como paga: a falta antiga
-- sumia da lista e a falta nova virava um crédito próprio. O total batia, mas
-- a ficha dizia que a falta de fevereiro tinha sido reposta numa aula a que a
-- aluna não veio (MGM, Giovanna e Gustavo, 13/10/2026 8h).
--
-- A regra, igual a `NAO_REPOEM` em `src/core/agenda/ocupacao.ts`: reposição
-- com falta, falta justificada, cancelada ou licença não paga nada, e a aula
-- que é reposição de outra nunca abre crédito próprio. Quem volta a ficar em
-- aberto é a falta que ela ia pagar. A ligação fica, para valer de novo se a
-- chamada for corrigida para presente.

set search_path = app_verandi, extensions;

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
