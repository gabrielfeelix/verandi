-- A parcela do cartão se paga sozinha.
--
-- Contrato vendido no cartão de crédito parcelado já foi pago pelo aluno no ato:
-- quem paga as parcelas ao estúdio, mês a mês, é a operadora. O MGM vende assim
-- quase tudo (12x R$ 525 no cartão), e o sistema materializava cada parcela como
-- cobrança aberta. Em 01/out/2026 o financeiro dele mostrava R$ 27.745 "em
-- atraso" que ninguém devia.
--
-- O servidor passa a registrar o pagamento dessas parcelas no dia do vencimento,
-- que é quando o dinheiro cai. `origem` separa esse pagamento do que a recepção
-- digita, e o índice único é o que impede duas abas abertas ao mesmo tempo de
-- quitar a mesma parcela duas vezes. Ele não olha `estornado_em` de propósito:
-- parcela estornada à mão não volta a ser paga pelo sistema.
set search_path = app_verandi, extensions;

alter table pagamento add column if not exists origem text not null default 'manual'
  check (origem in ('manual', 'cartao'));

create unique index if not exists pagamento_cartao_uk
  on pagamento (cobranca_id) where origem = 'cartao';

comment on column pagamento.origem is
  'manual: digitado no caixa; cartao: parcela de contrato no crédito, quitada pelo sistema no vencimento; ver 0065';
