-- A licença empurra o fim do plano, até um teto que é do plano.
--
-- O estúdio prorroga o plano de quem fica de licença: trimestral até 7 dias,
-- semestral até 15, anual até 30. Até aqui a recepção fazia isso à mão, em
-- "Registrar renovação", digitando uma data nova; e data digitada à mão é data
-- que ninguém sabe de onde veio quando está errada.
--
-- O teto mora no plano (`dias_licenca`), e não numa tabela de recorrências,
-- porque é o estúdio quem decide, e um plano anual promocional pode ter outro.
-- O que a licença rendeu fica na própria licença (`dias_prorrogados`), gravado
-- quando ela fecha, e corrigível: é o número que a recepção confere e acerta.
--
-- Não é `pausa`. Pausa é trancar: as vagas fecham e os meses parados deixam de
-- ser cobrados. Na licença a pessoa segue pagando e o horário segue guardado;
-- usar `pausa` aqui mexeria no financeiro sem ninguém pedir.

set search_path = app_verandi, extensions;

alter table plano add column if not exists dias_licenca int
  check (dias_licenca is null or dias_licenca between 0 and 365);

comment on column plano.dias_licenca is
  'quantos dias de licença, somados no contrato, o plano devolve no fim; nulo ou 0 é nenhum';

alter table licenca add column if not exists contrato_id uuid
  references contrato (id) on delete set null;
alter table licenca add column if not exists dias_prorrogados int
  check (dias_prorrogados is null or dias_prorrogados >= 0);

create index if not exists licenca_contrato_ix on licenca (contrato_id)
  where contrato_id is not null;

comment on column licenca.contrato_id is
  'o contrato cujo fim esta licença empurrou; gravado quando ela fecha';
comment on column licenca.dias_prorrogados is
  'quantos dias esta licença somou ao fim do contrato, já dentro do teto do plano';

/* a regra que o estúdio passou, nos planos que já existem */
update plano set dias_licenca = case recorrencia
    when 'trimestral' then 7
    when 'semestral' then 15
    when 'anual' then 30
  end
 where dias_licenca is null
   and recorrencia in ('trimestral', 'semestral', 'anual');
