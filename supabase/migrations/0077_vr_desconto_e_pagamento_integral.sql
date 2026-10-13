-- Desconto no contrato, e contrato recebido de uma vez.
--
-- O plano anual da MGM custa R$ 6.600 em 12x de R$ 550, e o aluno que renova
-- paga o ano inteiro de uma vez: à vista, ou no cartão parcelado pela
-- maquininha, que paga o estúdio pela operadora. O sistema só sabia cobrar
-- mês a mês, e o recibo saía com R$ 525, o valor de um mês. Desconto também
-- não existia: o Arnaldo Bernal renovou com R$ 374 a menos porque a esposa e o
-- filho pararam, e não havia onde dizer isso (Daniel, 13/10/2026).
--
-- `preco_aplicado_cent` continua sendo o que o aluno paga, já com desconto.
-- `desconto_cent` guarda o que saiu do preço do plano, e `desconto_motivo` o
-- porquê: o recibo mostra "valor do plano, desconto, total", e seis meses
-- depois alguém vai perguntar por que aquele contrato saiu mais barato.
--
-- `parcelas` vazio segue o plano. Com 1, o contrato inteiro vira uma cobrança
-- só, do valor total, na competência do início.

set search_path = app_verandi, extensions;

alter table contrato
  add column if not exists desconto_cent integer not null default 0,
  add column if not exists desconto_motivo text,
  add column if not exists parcelas integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'contrato_desconto_ck') then
    alter table contrato add constraint contrato_desconto_ck
      check (desconto_cent >= 0 and (desconto_cent = 0 or desconto_motivo is not null));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'contrato_parcelas_ck') then
    alter table contrato add constraint contrato_parcelas_ck
      check (parcelas is null or parcelas >= 1);
  end if;
end
$$;

comment on column contrato.desconto_cent is
  'quanto saiu do preço do plano; preco_aplicado_cent já vem com ele descontado';
comment on column contrato.parcelas is
  'vazio = segue o plano; 1 = recebido de uma vez, uma cobrança só do contrato inteiro';
