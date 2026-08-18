-- Tudo aqui nasce em `app_verandi`. Ver 0030.
set search_path = app_verandi, extensions;

/*
 * A matrícula, que é a camada comercial em cima do que já existe.
 *
 * O contrato **não** substitui a vaga: ele produz vagas. Quem lê ocupação, faz
 * chamada, controla reposição e busca lugar continua lendo `vaga`, exatamente
 * como sempre leu. Fazer o contrato virar a fonte da ocupação obrigaria a
 * reescrever a operação inteira para não entregar nada novo.
 *
 * O preço é congelado aqui, com o motivo dele ao lado: corrigir a tabela de
 * preços em março não pode reescrever o que foi vendido em janeiro, senão o
 * recibo passa a discordar da via impressa.
 */
create table if not exists contrato (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references conta(id) on delete cascade,
  pessoa_id uuid not null references pessoa(id) on delete cascade,
  -- `restrict`: plano que já foi vendido não some do catálogo por engano
  plano_id uuid not null references plano(id) on delete restrict,
  inicio date not null,
  -- nulo é contrato sem fim previsto, que é o mensal que renova sozinho
  fim date,
  dia_vencimento int check (dia_vencimento is null
                            or (dia_vencimento between 1 and 31)),
  preco_aplicado_cent int not null check (preco_aplicado_cent >= 0),
  -- por que aquele preço: sem isto, "por que a Marina pagou 195?" não tem
  -- resposta seis meses depois
  vinculo_usado boolean not null default false,
  forma_pagamento text check (forma_pagamento is null or forma_pagamento in
    ('pix','dinheiro','credito','debito','transferencia','boleto')),
  sessoes_contratadas int check (sessoes_contratadas is null
                                 or sessoes_contratadas >= 1),
  status text not null default 'ativo'
    check (status in ('ativo','pausado','encerrado')),
  criado_em timestamptz not null default now(),
  criado_por_usuario_id uuid references auth.users(id) on delete set null,
  check (fim is null or fim >= inicio)
);

create index if not exists contrato_pessoa_ix on contrato (pessoa_id);
create index if not exists contrato_conta_ix on contrato (conta_id)
  where status <> 'encerrado';

comment on table contrato is
  'a matrícula de alguém num plano, com preço congelado; ver 0055';
comment on column contrato.vinculo_usado is
  'true quando valeu o preço de quem já é cliente de outra modalidade';

/*
 * A licença, e a prorrogação que vem dela.
 *
 * A planilha do cliente tem as colunas "Licença/Prorrog" e "Novo Venc": quem
 * tranca dois meses volta e quer os dois meses de volta no fim. O intervalo
 * fica guardado, e o fim do contrato anda pelos dias parados.
 *
 * `fim` nulo é pausa em aberto, que é o estado de quem trancou e ainda não
 * disse quando volta.
 */
create table if not exists pausa (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references conta(id) on delete cascade,
  contrato_id uuid not null references contrato(id) on delete cascade,
  inicio date not null,
  fim date,
  motivo text,
  criado_em timestamptz not null default now(),
  check (fim is null or fim >= inicio)
);

create index if not exists pausa_contrato_ix on pausa (contrato_id);

comment on table pausa is
  'o período em que um contrato ficou parado, e que empurra o fim dele; ver 0055';

/*
 * As duas ligações que fazem o contrato saber o que aconteceu com ele.
 *
 * `vaga.contrato_id` é o que permite encerrar o contrato e fechar as vagas que
 * nasceram dele, sem tocar nas que a recepção criou à mão.
 *
 * `participacao.contrato_id` é o saldo do pacote de dez sessões: o consumido é
 * contado, e não guardado num contador que pode divergir do que de fato
 * aconteceu na sala.
 */
alter table vaga add column if not exists contrato_id uuid
  references contrato(id) on delete set null;
alter table participacao add column if not exists contrato_id uuid
  references contrato(id) on delete set null;

create index if not exists vaga_contrato_ix on vaga (contrato_id)
  where contrato_id is not null;
create index if not exists participacao_contrato_ix on participacao (contrato_id)
  where contrato_id is not null;

/*
 * A mesma pessoa não ocupa a mesma turma duas vezes ao mesmo tempo.
 *
 * Faltava, e `criarVaga` nunca conferiu nada. Uma matrícula que cria duas vagas
 * de uma vez torna o descuido barato demais: a pessoa apareceria duas vezes na
 * mesma chamada, e ninguém entenderia por quê.
 */
create unique index if not exists vaga_viva_unica_ix
  on vaga (serie_id, pessoa_id) where fim is null;

/*
 * Os campos que o formulário de matrícula do cliente pede, todos anuláveis.
 *
 * Ninguém é obrigado a preencher nada: 30% dos cadastros reais não têm nem
 * telefone, e exigir documento é o jeito mais rápido de a recepção inventar
 * número. O CPF importa porque recibo sem CPF do pagador não serve, e por isso
 * ele é único na conta: o mesmo documento em duas fichas é a mesma pessoa
 * cadastrada duas vezes.
 */
alter table pessoa add column if not exists cpf text;
alter table pessoa add column if not exists rg text;
alter table pessoa add column if not exists endereco text;
alter table pessoa add column if not exists endereco_numero text;
alter table pessoa add column if not exists complemento text;
alter table pessoa add column if not exists bairro text;
alter table pessoa add column if not exists cidade text;
alter table pessoa add column if not exists uf text check (uf is null or length(uf) = 2);
alter table pessoa add column if not exists cep text;
alter table pessoa add column if not exists sexo text;
alter table pessoa add column if not exists estado_civil text;
alter table pessoa add column if not exists profissao text;
alter table pessoa add column if not exists telefone_residencial text;
alter table pessoa add column if not exists telefone_comercial text;

create unique index if not exists pessoa_cpf_ix
  on pessoa (conta_id, cpf) where cpf is not null;

comment on column pessoa.cpf is
  'só dígitos, único na conta; é o que um recibo precisa para valer';

alter table contrato enable row level security;
alter table pausa enable row level security;

create policy contrato_conta on contrato for all
  using (conta_id in (select app_verandi.contas_do_usuario()))
  with check (conta_id in (select app_verandi.contas_do_usuario()));

create policy pausa_conta on pausa for all
  using (conta_id in (select app_verandi.contas_do_usuario()))
  with check (conta_id in (select app_verandi.contas_do_usuario()));
