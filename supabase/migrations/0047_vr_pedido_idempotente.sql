-- Tudo aqui nasce em `app_verandi`. `public` fica fora do caminho de
-- propósito: é onde o AutoFluxos mora, e nome sem schema não pode cair lá por
-- acidente. Ver 0030.
set search_path = app_verandi, extensions;

/*
 * A defesa contra a chamada repetida.
 *
 * O bot repete: a rede cai no meio, o WhatsApp reentrega a mensagem, a esteira
 * roda duas vezes por um retry que ninguém configurou. Sem defesa, o primeiro
 * dia de produção tem gente marcada em duplicidade numa turma de quatro, e quem
 * descobre é a professora contando cabeças.
 *
 * O contrato é o de mercado: quem chama manda `Idempotency-Key`, e a segunda
 * chamada com a mesma chave recebe **a mesma resposta**, com o mesmo status, sem
 * executar nada de novo.
 */
create table pedido_idempotente (
  /*
   * A chave é escolhida por quem chama, então ela **só é única dentro da
   * conta**. Dois clientes diferentes mandando "abc" são dois pedidos
   * diferentes, e um `unique` global faria o segundo receber a resposta do
   * primeiro: vazamento de dado entre contas por uma string em comum.
   */
  conta_id   uuid not null references conta (id) on delete cascade,
  chave      text not null check (length(btrim(chave)) between 1 and 200),

  /*
   * A rota entra na identidade porque a mesma chave em rotas diferentes é uso
   * legítimo: uma esteira que gera um id por conversa usaria o mesmo valor para
   * cadastrar a pessoa e para marcar o horário dela.
   */
  rota       text not null,

  /*
   * `sha256` do corpo, para pegar o erro mais chato do gênero: mesma chave, corpo
   * diferente. Isso não é reentrega, é bug de quem chama, e devolver a resposta
   * antiga marcaria silenciosamente o horário errado. A rota recusa com 422.
   */
  corpo_hash text not null,

  /*
   * A resposta guardada, inteira, do jeito que saiu. Guardar o status junto é o
   * que permite repetir um 201 como 201, e não como 200: quem chama pode estar
   * decidindo pelo código.
   */
  status     integer not null,
  corpo      jsonb   not null,

  criado_em  timestamptz not null default now(),

  primary key (conta_id, chave, rota)
);

/*
 * Pedido idempotente é lixo com prazo: ele existe para cobrir a reentrega, que
 * acontece em minutos, não em meses. O índice existe para a limpeza futura
 * conseguir varrer por data sem ler a tabela inteira.
 */
create index pedido_idempotente_idade on pedido_idempotente (criado_em);

comment on table pedido_idempotente is
  'resposta guardada de escrita já executada, por conta e por rota. Só o '
  'servidor escreve e lê; não é dado de conta de cliente';

alter table pedido_idempotente enable row level security;

/*
 * GRANT é camada separada de RLS: tabela criada por migration não recebe
 * privilégio sozinha, e sem isto até um `select` legítimo leva 42501. Se o erro
 * for 42501, olhe o grant antes da política.
 */
grant select, insert, update, delete on all tables in schema app_verandi to authenticated;
grant all on all tables in schema app_verandi to service_role;

/*
 * E agora a parte que o bloco acima acabou de desfazer, de propósito nesta
 * ordem. O `alter default privileges` da 0030 concede a `authenticated` tudo que
 * nasce aqui, e esta tabela guarda o corpo de respostas da API: um `select`
 * solto nela entregaria nome e telefone de quem o bot cadastrou. RLS ligada sem
 * política já recusa; o `revoke` é o segundo cadeado. `service_role`, que é quem
 * a API usa, passa por cima dos dois.
 */
revoke all on pedido_idempotente from anon, authenticated;
