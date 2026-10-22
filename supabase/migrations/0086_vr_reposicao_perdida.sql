-- Faltar na reposição segue a regra de faltar numa aula comum.
--
-- A 0075 fez a falta na reposição devolver sempre a falta antiga. Na MGM, onde
-- falta sem aviso não dá crédito (0076, do mesmo dia), a aluna que faltou sem
-- avisar na reposição ganhava a aula de volta (Carolina Garcia, reposição de
-- 13/08 perdida em 21/10 9h, e outros 13 alunos).
--
-- Agora a falta antiga só volta se a falta na reposição daria crédito pelas
-- regras da conta (`credito_falta`, `credito_falta_avisada`), ou se a aula foi
-- cancelada ou era licença. Igual a `naoRepoem` em `src/core/agenda/ocupacao.ts`.
-- Nada é apagado: corrigir a chamada devolve o crédito.

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
      -- falta sem aviso só conta se a conta der crédito para ela
      and (pa.status <> 'falta'
           or (select c.credito_falta from conta c where c.id = p.conta_id))
      and pa.credito_encerrado_em is null
      -- a aula que é reposição de outra não abre crédito próprio
      and pa.reposicao_de_id is null
      -- reposição perdida paga a falta; só não paga quando a falta nela daria
      -- crédito pelas regras da conta, ou foi cancelada ou licença (`naoRepoem`)
      and not exists (select 1 from participacao r
                       join conta c on c.id = p.conta_id
                       where r.reposicao_de_id = pa.id
                         and not (r.status in ('cancelada', 'licenca')
                                  or (r.status = 'falta' and c.credito_falta)
                                  or (r.status = 'falta_avisada' and c.credito_falta_avisada)))
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
