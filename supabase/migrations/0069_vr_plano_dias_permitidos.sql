-- Dias permitidos no plano de horário livre.
--
-- "Terça e quinta, 2x por semana, em qualquer horário desses dias": o limite
-- da semana continua em `frequencia_semanal`, e os dias em que a aula pode
-- ser marcada ficam aqui, como dia da semana (0 = domingo, 6 = sábado).
-- Nulo é qualquer dia, que é o que todo plano já existente continua sendo.

set search_path = app_verandi, extensions;

alter table app_verandi.plano
  add column if not exists dias_permitidos smallint[];

alter table app_verandi.plano
  drop constraint if exists plano_dias_permitidos_validos;
alter table app_verandi.plano
  add constraint plano_dias_permitidos_validos check (
    dias_permitidos is null
    or (cardinality(dias_permitidos) between 1 and 7
        and dias_permitidos <@ array[0,1,2,3,4,5,6]::smallint[])
  );

comment on column app_verandi.plano.dias_permitidos is
  'só no horário livre: dias da semana em que a aula pode ser marcada (0 = domingo); nulo é qualquer dia';
