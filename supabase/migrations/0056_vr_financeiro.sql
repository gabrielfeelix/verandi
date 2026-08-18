-- Tudo aqui nasce em `app_verandi`. `public` fica fora do caminho de
-- propósito: é onde o AutoFluxos mora, e nome sem schema não pode cair lá por
-- acidente. Ver 0030.
set search_path = app_verandi, extensions;

/*
 * O que o contrato deve, mês a mês.
 *
 * A cobrança **nasce do contrato**, e não da mão de quem atende: o contrato já
 * diz quanto custa, de quanto em quanto tempo e em que dia vence, e digitar
 * isso de novo todo mês é a planilha de volta com um banco embaixo.
 *
 * Ela é **materializada**, e não agendada. O plano gratuito da Vercel não dá
 * cron, e é a mesma restrição que a agenda já resolveu na `materializarJanela`:
 * as linhas nascem quando alguém abre a tela, e o índice único abaixo é o que
 * transforma corrida em conflito ignorado. Duas abas abertas ao mesmo tempo não
 * cobram duas vezes, e não existe job para alguém esquecer de rodar.
 *
 * Dinheiro é inteiro em centavos. Ver 0054.
 */
create table if not exists cobranca (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references conta(id) on delete cascade,
  -- `restrict`: cobrança órfã é dívida que ninguém sabe de onde veio
  contrato_id uuid not null references contrato(id) on delete restrict,
  pessoa_id uuid not null references pessoa(id) on delete cascade,
  -- o dia 1 do mês que a cobrança cobre; é ela que dá o "referente a"
  competencia date not null,
  vencimento date not null,
  valor_cent int not null check (valor_cent >= 0),
  /*
   * Dois valores, e "paga" não é um deles: pago é o que a soma dos pagamentos
   * diz, e uma coluna que repete essa soma é uma coluna que um dia diverge
   * dela. É a mesma decisão de Pendências: grava-se o ato, lê-se o estado.
   * "Atrasada" também não mora aqui, porque depende de hoje e do fuso da conta.
   */
  status text not null default 'aberta' check (status in ('aberta','cancelada')),
  -- `sistema` é o que o contrato produziu; `manual` existe para a exceção que
  -- ainda não apareceu ter onde morar sem migration corretiva
  origem text not null default 'sistema' check (origem in ('sistema','manual')),
  motivo_cancelamento text,
  criado_em timestamptz not null default now(),
  check (vencimento >= competencia - 31)
);

/*
 * A idempotência da materialização, e ela é o coração deste módulo.
 *
 * Sem este índice, abrir a tela duas vezes cobra duas vezes, e o defeito só
 * aparece na conversa em que o cliente diz que pagou.
 */
create unique index if not exists cobranca_competencia_ix
  on cobranca (contrato_id, competencia);

create index if not exists cobranca_conta_venc_ix
  on cobranca (conta_id, vencimento) where status = 'aberta';
create index if not exists cobranca_pessoa_ix on cobranca (pessoa_id);

comment on table cobranca is
  'o que um contrato deve numa competência; materializada, nunca agendada; ver 0056';
comment on column cobranca.competencia is
  'dia 1 do mês coberto; é o "referente a" do recibo';

/*
 * O que entrou, quando, e por qual forma.
 *
 * Tabela, e não duas colunas na cobrança: quem recebe metade hoje e metade no
 * dia 20 recebeu duas vezes, em duas datas e possivelmente em duas formas, e o
 * fechamento do dia precisa das duas. Com um campo só, a segunda entrada apaga
 * a data da primeira, e o caixa de hoje passa a mentir sobre ontem.
 *
 * Estorno em vez de apagar: pagamento registrado errado é um fato que
 * aconteceu, alguém digitou. Apagar a linha faria o fechamento de ontem, que já
 * foi conferido e talvez impresso, mudar de valor sozinho.
 */
create table if not exists pagamento (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references conta(id) on delete cascade,
  cobranca_id uuid not null references cobranca(id) on delete cascade,
  valor_cent int not null check (valor_cent > 0),
  forma text not null check (forma in
    ('pix','dinheiro','credito','debito','transferencia','boleto')),
  recebido_em date not null,
  observacao text,
  registrado_por_usuario_id uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  estornado_em timestamptz,
  motivo_estorno text,
  -- estorno sem motivo é estorno que ninguém explica depois
  constraint pagamento_estorno_tem_motivo
    check (estornado_em is null or motivo_estorno is not null)
);

create index if not exists pagamento_cobranca_ix on pagamento (cobranca_id);
create index if not exists pagamento_conta_data_ix
  on pagamento (conta_id, recebido_em) where estornado_em is null;

comment on table pagamento is
  'o dinheiro que entrou contra uma cobrança; estorna, nunca apaga; ver 0056';

/*
 * A cobrança com o que já foi pago, que é o que toda tela pergunta.
 *
 * View, e não coluna, pelo motivo escrito acima. `security_invoker` é
 * obrigatório: sem ele a view roda com os direitos de quem a criou e passa por
 * cima da RLS das tabelas de baixo, entregando a conta de todo mundo. Ver 0034.
 *
 * "Atrasada" não sai daqui de propósito: ela depende de hoje no fuso da conta, e
 * `current_date` no banco é o fuso do servidor, que é outro. Quem sabe o dia de
 * hoje da conta é `src/server`.
 */
create or replace view cobranca_resumo with (security_invoker = true) as
  select
    c.id, c.conta_id, c.contrato_id, c.pessoa_id, c.competencia, c.vencimento,
    c.valor_cent, c.status, c.origem, c.motivo_cancelamento, c.criado_em,
    coalesce((
      select sum(p.valor_cent) from pagamento p
       where p.cobranca_id = c.id and p.estornado_em is null
    ), 0)::int as valor_pago_cent,
    case
      when c.status = 'cancelada' then 'cancelada'
      when coalesce((
        select sum(p.valor_cent) from pagamento p
         where p.cobranca_id = c.id and p.estornado_em is null
      ), 0) >= c.valor_cent then 'paga'
      when coalesce((
        select sum(p.valor_cent) from pagamento p
         where p.cobranca_id = c.id and p.estornado_em is null
      ), 0) > 0 then 'parcial'
      else 'aberta'
    end as situacao
  from cobranca c;

grant select on cobranca_resumo to authenticated, service_role;

comment on view cobranca_resumo is
  'a cobrança mais o pago e a situação; atraso não sai daqui, depende do fuso';

alter table cobranca enable row level security;
alter table pagamento enable row level security;

/*
 * Isolamento por conta, como todas as outras. Quem filtra papel é `src/server`:
 * dinheiro é do dono e da recepção, e "recepção" é linha em `usuario_conta`,
 * não papel do Postgres. Mesmo motivo escrito na 0043, na 0053 e na 0054.
 */
create policy cobranca_conta on cobranca for all
  using (conta_id in (select app_verandi.contas_do_usuario()))
  with check (conta_id in (select app_verandi.contas_do_usuario()));

create policy pagamento_conta on pagamento for all
  using (conta_id in (select app_verandi.contas_do_usuario()))
  with check (conta_id in (select app_verandi.contas_do_usuario()));
