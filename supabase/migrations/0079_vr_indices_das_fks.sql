-- Índices para as chaves estrangeiras de `participacao` e `sessao` que o aviso
-- do painel apontou em 19/out/2026.
--
-- São as duas tabelas que crescem toda semana: 25 mil participações e 9,6 mil
-- sessões naquele dia. Sem índice, procurar a reposição de uma falta, ou as
-- aulas de um profissional, varre a tabela inteira (1,3 a 2,8 ms medidos), e
-- apagar um profissional, serviço, local ou usuário faz a mesma varredura
-- para conferir a chave.
--
-- Parciais onde a coluna aceita vazio: a maioria das participações não é
-- reposição, e sessão sem local ou profissional nunca é buscada por eles.
-- As outras chaves sem índice do aviso estão em tabelas de poucas centenas
-- de linhas, onde índice só custaria escrita.

set search_path = app_verandi, extensions;

create index if not exists participacao_reposicao_de_ix
  on app_verandi.participacao (reposicao_de_id)
  where reposicao_de_id is not null;

create index if not exists participacao_registrado_por_ix
  on app_verandi.participacao (registrado_por_usuario_id)
  where registrado_por_usuario_id is not null;

create index if not exists sessao_profissional_ix
  on app_verandi.sessao (profissional_id)
  where profissional_id is not null;

create index if not exists sessao_servico_ix
  on app_verandi.sessao (servico_id);

create index if not exists sessao_local_ix
  on app_verandi.sessao (local_id)
  where local_id is not null;
