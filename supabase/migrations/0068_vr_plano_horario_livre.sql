-- Plano de horário livre.
--
-- "Mensal 2x por semana" tinha um sentido só: dois lugares fixos na grade,
-- toda semana os mesmos. Academia, boxe e muito estúdio vendem outra coisa:
-- o direito a duas aulas por semana, em qualquer horário que exista e tenha
-- lugar. Terça às 15h nesta semana, quarta às 19h na outra.
--
-- Com `horario_livre`, o contrato não ocupa lugar na grade. Cada aula é
-- marcada avulsa, nasce com `participacao.contrato_id` apontando para o
-- contrato, e o encaixe recusa a que passar de `frequencia_semanal` na mesma
-- semana (segunda a domingo).

set search_path = app_verandi, extensions;

alter table app_verandi.plano
  add column if not exists horario_livre boolean not null default false;

comment on column app_verandi.plano.horario_livre is
  'true: o contrato não fixa horário; a pessoa marca até frequencia_semanal aulas por semana, em qualquer horário da modalidade';
