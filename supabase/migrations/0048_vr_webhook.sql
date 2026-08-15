-- Tudo aqui nasce em `app_verandi`. `public` fica fora do caminho de
-- propósito: é onde o AutoFluxos mora, e nome sem schema não pode cair lá por
-- acidente. Ver 0030.
set search_path = app_verandi, extensions;

/*
 * A volta da conversa.
 *
 * Até aqui o bot pergunta e a Verandi responde. Falta o contrário: a recepção
 * cancela a aula de quinta pela tela, e o bot precisa saber para avisar as seis
 * pessoas que iam. Sem isto, quem avisa é o cliente chegando na porta fechada.
 */

-- ---------------------------------------------------------------------------
-- Para onde avisar
-- ---------------------------------------------------------------------------

create table webhook (
  id       uuid primary key default gen_random_uuid(),
  conta_id uuid not null references conta (id) on delete cascade,

  url      text not null check (url ~ '^https://'),

  /*
   * **Este segredo é guardado em claro, e é a única exceção do produto.**
   *
   * `chave_api` e `convite` guardam `sha256` porque quem chega **apresenta** o
   * segredo e nós só conferimos. Aqui é o inverso: nós **assinamos** com ele, e
   * quem recebe confere refazendo a mesma conta. Assinatura HMAC exige que os
   * dois lados tenham o mesmo valor, então hash tornaria a assinatura
   * impossível, não mais segura.
   *
   * O que dá para fazer, e está feito: é por conta, aparece uma vez na tela,
   * dá para trocar sem derrubar a integração, e só o servidor lê. É o mesmo
   * desenho que Stripe e GitHub usam, pelo mesmo motivo.
   */
  segredo  text not null,

  ativo     boolean not null default true,
  criado_em timestamptz not null default now(),

  /*
   * Um destino por conta. Dois destinos parecem flexibilidade e são a porta de
   * entrada de "por que o evento chegou duplicado?": o dia em que houver a
   * segunda integração, isto vira lista com nome, junto com escopo por chave.
   */
  unique (conta_id)
);

alter table webhook enable row level security;

/*
 * **Sem política, e isso é decisão.**
 *
 * A tentação era copiar a de `chave_api`, "dono e suporte podem tudo". Ali o
 * banco guarda hash, então ler a linha não entrega nada. Aqui o banco guarda o
 * segredo em claro: uma política de leitura para `authenticated` faria o
 * "aparece uma vez" virar mentira, porque bastaria consultar a tabela.
 *
 * Então ninguém logado alcança esta tabela, nem o dono. Quem escreve e lê é
 * `src/server`, com a chave de serviço, depois de conferir o papel, que é o
 * mesmo caminho que a observação restrita já usa. Vira política de verdade no
 * dia em que o segredo puder ser guardado cifrado com chave fora do banco.
 */

-- ---------------------------------------------------------------------------
-- A fila de saída
-- ---------------------------------------------------------------------------

/*
 * **Outbox, e não chamada direta.**
 *
 * O evento é gravado aqui pela mesma ação que mexeu no dado, e um entregador
 * manda depois. Chamar o webhook dentro da ação amarraria o cancelamento da
 * aula à disponibilidade do outro sistema: com o AutoFluxos fora do ar, a
 * recepção deixaria de conseguir cancelar uma aula na Verandi. O produto de um
 * não pode parar por causa do outro.
 *
 * A segunda razão é a reentrega. Chamada direta que falha some; linha em tabela
 * que falha continua lá, com a hora da próxima tentativa.
 */
create table evento_saida (
  id       uuid primary key default gen_random_uuid(),
  conta_id uuid not null references conta (id) on delete cascade,

  tipo     text not null check (tipo in
             ('participacao.criada', 'participacao.cancelada', 'sessao.cancelada')),

  /* o corpo, já pronto, do jeito que vai sair. Montar na entrega significaria
     reler um dado que pode ter mudado, e mandar um evento que não aconteceu */
  dados    jsonb not null,

  tentativas          integer not null default 0,
  /* nulo quer dizer "não tente mais": ou entregou, ou desistiu */
  proxima_tentativa_em timestamptz default now(),
  entregue_em         timestamptz,
  ultimo_erro         text,

  criado_em timestamptz not null default now()
);

/* o índice que o entregador usa: o que está vencido, na ordem em que aconteceu */
create index evento_saida_a_entregar
  on evento_saida (proxima_tentativa_em, criado_em)
  where entregue_em is null and proxima_tentativa_em is not null;

comment on table evento_saida is
  'fila de eventos para o webhook da conta. Só o servidor escreve e lê';

alter table evento_saida enable row level security;

/*
 * GRANT é camada separada de RLS: tabela criada por migration não recebe
 * privilégio sozinha, e sem isto até um `select` legítimo leva 42501.
 */
grant select, insert, update, delete on all tables in schema app_verandi to authenticated;
grant all on all tables in schema app_verandi to service_role;

/*
 * E o cadeado que o bloco acima acabou de abrir, de propósito nesta ordem.
 *
 * `evento_saida` guarda o corpo dos eventos, com nome de quem foi marcado e
 * desmarcado: um `select` solto nela é a agenda da conta inteira. E `webhook`
 * guarda o segredo de assinatura em claro, que é o que ninguém logado pode ler,
 * nem o dono: ele vê o segredo uma vez, na criação, pela tela. RLS já recusa;
 * o `revoke` é o segundo cadeado, e `service_role` passa por cima dos dois.
 */
revoke all on evento_saida from anon, authenticated;
revoke all on webhook from anon, authenticated;

/*
 * O log já sabia falar de configuração e de integração; agora sabe falar de
 * destino de aviso. Trocar a URL do webhook é a mudança mais parecida com
 * "redirecionar tudo" que a tela permite, e precisa deixar rastro com nome.
 *
 * `check` de texto é lista fechada por decisão, então cresce na mão.
 */
alter table log_configuracao
  drop constraint log_configuracao_entidade_check,
  add constraint log_configuracao_entidade_check check (entidade in
    ('serie','servico','profissional','local','vocabulario',
     'funcionamento','excecao_calendario','usuario_conta','convite','conta',
     'pessoa','chave_api','webhook'));
