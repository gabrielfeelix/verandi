-- Índices para as duas leituras do sino de notificações.
--
-- `notificacoesDaConta` roda a cada abertura de página: 7,5 mil vezes cada
-- leitura até 19/out/2026, e eram as duas que mais somavam tempo no banco da
-- Verandi. A de presenças filtra por `conta_id` e ordena por `registrado_em`,
-- e sem índice para isso varria as 25 mil participações para achar umas
-- poucas da semana (12,5 ms, 24.911 linhas descartadas). A de aulas
-- canceladas usava o índice por `inicio` e descartava toda aula não cancelada
-- no caminho.
--
-- Os dois servem exatamente o filtro e a ordem que o sino pede.

set search_path = app_verandi, extensions;

create index if not exists participacao_registrado_ix
  on app_verandi.participacao (conta_id, registrado_em desc);

create index if not exists sessao_cancelada_ix
  on app_verandi.sessao (conta_id, inicio desc)
  where status = 'cancelada';
