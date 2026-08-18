-- Tudo aqui nasce em `app_verandi`. `public` fica fora do caminho de
-- propósito: é onde o AutoFluxos mora, e nome sem schema não pode cair lá por
-- acidente. Ver 0030.
set search_path = app_verandi, extensions;

/*
 * O catálogo do que o negócio vende.
 *
 * O pedido nasceu de uma tabela de preços mantida à mão num documento, com
 * quarenta e dois planos, código repetido em três lugares e quatro linhas
 * rotuladas "aluno" que pelo preço são de não-aluno. Metade do valor deste
 * módulo é o banco recusar o código repetido; a outra metade é o preço parar de
 * ser digitado de novo a cada matrícula.
 *
 * Dois preços por plano, e não dois planos: o mesmo serviço custa um valor para
 * quem já é cliente de outra modalidade e outro para quem não é. Escrito como
 * dois planos, o recibo diz o nome errado e o relatório soma serviço com
 * serviço. Ver docs/planos/13-administrativo.md.
 *
 * Dinheiro é inteiro em centavos. Ponto flutuante em parcela produz dízima, e a
 * diferença aparece no recibo, que é o único lugar onde ela não pode aparecer.
 */
create table if not exists plano (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references conta(id) on delete cascade,
  codigo text not null,
  nome text not null,
  -- `restrict`, e não `cascade`: apagar uma modalidade não pode levar junto o
  -- preço pelo qual ela já foi vendida
  servico_id uuid not null references servico(id) on delete restrict,
  recorrencia text not null
    check (recorrencia in ('mensal','trimestral','semestral','anual','avulsa','pacote')),
  parcelas int not null default 1 check (parcelas >= 1),
  frequencia_semanal int check (frequencia_semanal is null or frequencia_semanal >= 1),
  sessoes_no_pacote int check (sessoes_no_pacote is null or sessoes_no_pacote >= 1),
  validade_meses int check (validade_meses is null or validade_meses >= 1),
  preco_vinculado_cent int not null check (preco_vinculado_cent >= 0),
  preco_avulso_cent int not null check (preco_avulso_cent >= 0),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (conta_id, codigo),
  -- pacote sem quantidade é pacote de quantas sessões? a pergunta não tem
  -- resposta depois, então ela é feita agora
  constraint plano_pacote_tem_sessoes
    check (recorrencia <> 'pacote' or sessoes_no_pacote is not null)
);

create index if not exists plano_conta_ix on plano (conta_id) where ativo;

comment on table plano is
  'o catálogo do que a conta vende, com código único e dois preços; ver 0054';
comment on column plano.preco_vinculado_cent is
  'preço de quem já é cliente de outra modalidade, em centavos';
comment on column plano.preco_avulso_cent is
  'preço de quem não é, em centavos; igual ao outro quando o plano tem preço único';

/*
 * O número da turma.
 *
 * O documento do cliente chama as setenta turmas de "001 - Segunda 7h00", e a
 * recepção fala por esse número no telefone. Anulável porque conta nenhuma é
 * obrigada a numerar turma, e único por conta porque número repetido não
 * identifica nada.
 */
alter table serie add column if not exists codigo text;
create unique index if not exists serie_codigo_ix
  on serie (conta_id, codigo) where codigo is not null;

comment on column serie.codigo is
  'o número pelo qual a recepção chama a turma; opcional, único na conta';

/*
 * A categoria da modalidade.
 *
 * A tabela de preços separa "Pilates" de "Fisioterapia e terapias", e são sete
 * serviços de um lado só. Texto anulável, e não tabela: é agrupamento de
 * exibição, e tabela para três palavras cobra manutenção sem devolver nada.
 */
alter table servico add column if not exists categoria text;

comment on column servico.categoria is
  'agrupa modalidades parecidas na tabela de preços; opcional';

alter table plano enable row level security;

/*
 * Isolamento por conta, como todas as outras. Quem filtra papel é `src/server`:
 * preço é do dono, e "dono" é linha em `usuario_conta`, não papel do Postgres.
 * O mesmo motivo escrito na 0043 e na 0053.
 */
create policy plano_conta on plano for all
  using (conta_id in (select app_verandi.contas_do_usuario()))
  with check (conta_id in (select app_verandi.contas_do_usuario()));
