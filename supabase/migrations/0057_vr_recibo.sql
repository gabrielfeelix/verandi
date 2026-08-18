-- Tudo aqui nasce em `app_verandi`. Ver 0030.
set search_path = app_verandi, extensions;

/*
 * Quem emite o recibo.
 *
 * Recibo sem cabeçalho não comprova nada: quem paga precisa saber para quem
 * pagou, e o documento do emitente é o que torna o papel oponível a alguém. São
 * campos da conta, e não do sistema, porque cada estúdio emite pelo próprio
 * CNPJ.
 *
 * `serie_recibo` existe porque talão de papel tem série, e porque o dia em que
 * o estúdio abrir a segunda unidade a sequência precisa poder recomeçar sem
 * colidir com a primeira.
 */
alter table conta add column if not exists razao_social text;
alter table conta add column if not exists documento text;
alter table conta add column if not exists endereco_emitente text;
alter table conta add column if not exists telefone_emitente text;
alter table conta add column if not exists serie_recibo text not null default 'A';

comment on column conta.documento is
  'CNPJ ou CPF de quem emite o recibo, só dígitos';

/*
 * A sequência do recibo, uma por conta e série.
 *
 * Tabela, e não `sequence` do Postgres: `sequence` é global ao schema e não sabe
 * de conta, e uma por conta criada em tempo de execução seria DDL disparado por
 * clique de usuário. Aqui a alocação é um `update ... returning`, que trava a
 * linha e serializa os concorrentes.
 *
 * A numeração **não pode pular**: buraco na sequência é a primeira coisa que uma
 * fiscalização pergunta. Por isso o número cancelado continua ocupado, e por
 * isso a correção cria versão nova em vez de número novo.
 */
create table if not exists contador_recibo (
  conta_id uuid not null references conta(id) on delete cascade,
  serie text not null,
  proximo int not null default 1 check (proximo >= 1),
  primary key (conta_id, serie)
);

comment on table contador_recibo is
  'a sequência de recibo por conta e série; alocada com trava de linha; ver 0057';

/*
 * O recibo: a foto de um pagamento no instante em que ele foi reconhecido.
 *
 * Ele aponta para `pagamento`, e não para `cobranca`, e a planilha do cliente
 * concorda: a coluna "nº recibo" do item 4 fica ao lado de "Forma pg" e "pg
 * em", que são atributos do pagamento. Quem pagou metade em dezembro e metade
 * em janeiro recebeu dois recibos, de valores e datas diferentes.
 *
 * `corpo` é o que foi impresso, congelado. Uma segunda via emitida daqui a um
 * ano precisa sair idêntica à primeira, e nenhuma outra tabela deste sistema
 * promete não mudar: o preço do plano muda, o endereço da pessoa muda, e o nome
 * dela some no dia em que ela pedir exclusão.
 */
create table if not exists recibo (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references conta(id) on delete cascade,
  serie text not null,
  numero int not null check (numero >= 1),
  versao int not null default 1 check (versao >= 1),
  -- `set null`: o recibo sobrevive ao que ele descreve, e é essa a razão de ele
  -- existir. Ver a decisão de guarda por cinco anos, no plano 13.
  pagamento_id uuid references pagamento(id) on delete set null,
  pessoa_id uuid references pessoa(id) on delete set null,
  contrato_id uuid references contrato(id) on delete set null,
  substitui_id uuid references recibo(id) on delete set null,
  valor_cent int not null check (valor_cent >= 0),
  status text not null default 'valido'
    check (status in ('valido','cancelado','substituido')),
  corpo jsonb not null,
  emitido_em timestamptz not null default now(),
  emitido_por_usuario_id uuid references auth.users(id) on delete set null,
  cancelado_em timestamptz,
  motivo text,
  -- cancelar sem motivo é cancelar sem explicação, e o documento pede o
  -- contrário: o número fica ocupado, e alguém vai perguntar por quê
  constraint recibo_cancelado_tem_motivo
    check (status <> 'cancelado' or motivo is not null),
  unique (conta_id, serie, numero, versao)
);

create index if not exists recibo_conta_ix on recibo (conta_id, emitido_em desc);
create index if not exists recibo_pagamento_ix on recibo (pagamento_id)
  where pagamento_id is not null;
create index if not exists recibo_pessoa_ix on recibo (pessoa_id)
  where pessoa_id is not null;

comment on table recibo is
  'o comprovante de um pagamento, com número que não pula e corpo congelado; ver 0057';
comment on column recibo.corpo is
  'o que foi impresso, como estava no dia; nunca é recalculado';

/*
 * A alocação do número, com trava de linha.
 *
 * `select max(numero) + 1` no aplicativo entrega o mesmo número a dois balcões
 * que clicam ao mesmo tempo, e o defeito só aparece quando os dois papéis já
 * estão na mão de duas pessoas. Aqui o `insert ... on conflict do update`
 * trava a linha do contador e serializa quem chegar depois.
 *
 * `security definer` com `search_path` fixo, no mesmo padrão de
 * `contas_do_usuario()`: sem isso a função roda com o schema de quem chama.
 */
create or replace function app_verandi.proximo_numero_recibo(
  p_conta uuid, p_serie text
) returns int
language plpgsql
security definer
set search_path = app_verandi
as $$
declare
  v_numero int;
begin
  if not exists (
    select 1 from app_verandi.usuario_conta
     where usuario_id = auth.uid() and conta_id = p_conta and ativo
  ) then
    raise exception 'sem acesso a esta conta';
  end if;

  insert into app_verandi.contador_recibo (conta_id, serie, proximo)
  values (p_conta, p_serie, 2)
  on conflict (conta_id, serie)
    do update set proximo = app_verandi.contador_recibo.proximo + 1
  returning proximo - 1 into v_numero;

  return v_numero;
end;
$$;

comment on function app_verandi.proximo_numero_recibo is
  'aloca o próximo número da série, com trava de linha; nunca pula';

grant execute on function app_verandi.proximo_numero_recibo(uuid, text)
  to authenticated, service_role;

alter table recibo enable row level security;
alter table contador_recibo enable row level security;

/*
 * Isolamento por conta, como todas as outras. Quem filtra papel é `src/server`:
 * recibo é do dono e da recepção, e "recepção" é linha em `usuario_conta`.
 */
create policy recibo_conta on recibo for all
  using (conta_id in (select app_verandi.contas_do_usuario()))
  with check (conta_id in (select app_verandi.contas_do_usuario()));

create policy contador_recibo_conta on contador_recibo for all
  using (conta_id in (select app_verandi.contas_do_usuario()))
  with check (conta_id in (select app_verandi.contas_do_usuario()));

/*
 * O log passa a aceitar o recibo, e desta vez antes de alguém precisar dele.
 * A `0056` corrigiu a lista que tinha parado na `0048` e engolia `plano` e
 * `contrato` em silêncio; a lição foi acrescentar a entidade na mesma migration
 * que cria a tabela.
 */
alter table log_configuracao drop constraint if exists log_configuracao_entidade_check;
alter table log_configuracao
  add constraint log_configuracao_entidade_check check (entidade in
    ('serie','servico','profissional','local','vocabulario',
     'funcionamento','excecao_calendario','usuario_conta','convite','conta',
     'pessoa','chave_api','webhook','plano','contrato','cobranca','pagamento',
     'recibo'));
