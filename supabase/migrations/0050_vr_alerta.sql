-- Tudo aqui nasce em `app_verandi`. `public` fica fora do caminho de
-- propósito: é onde o AutoFluxos mora, e nome sem schema não pode cair lá por
-- acidente. Ver 0030.
set search_path = app_verandi, extensions;

/*
 * Saber quando quebra.
 *
 * Hoje um 500 em produção é invisível: o `console.error` vai para o log da
 * Vercel, que ninguém abre de manhã. Com um cliente e o Gabriel olhando, dá para
 * viver assim. Com cinco, **o cliente vira o monitoramento**, e isso custa o
 * cliente.
 *
 * Esta tabela não guarda o erro: guarda **que já avisamos sobre ele**. Sem isso,
 * um defeito numa tela muito usada manda quatrocentos e-mails em dez minutos, a
 * caixa vira lixo, e a regra que todo mundo aprende é ignorar o alerta. Alerta
 * que ninguém lê é pior que alerta nenhum, porque dá a sensação de que existe
 * vigilância.
 */
create table alerta_enviado (
  /*
   * O `sha256` da assinatura do erro: mensagem mais lugar, sem o que varia
   * (id, hora, nome de pessoa). Erro igual em cem requisições tem uma linha só.
   */
  assinatura  text primary key,

  /* o texto curto, para quem abrir a tabela entender sem ir ao log */
  resumo      text not null,

  /* quantas vezes ele aconteceu desde o primeiro aviso, incluindo os calados */
  ocorrencias integer not null default 1,

  primeiro_em timestamptz not null default now(),
  ultimo_em   timestamptz not null default now(),
  /* quando o e-mail saiu. É o que define a janela de silêncio */
  avisado_em  timestamptz not null default now()
);

create index alerta_enviado_recente on alerta_enviado (ultimo_em desc);

comment on table alerta_enviado is
  'controle de repetição do aviso de erro. Não guarda o erro, guarda que já '
  'avisamos: sem isso um defeito em tela movimentada manda centenas de e-mails';

alter table alerta_enviado enable row level security;

grant select, insert, update, delete on all tables in schema app_verandi to authenticated;
grant all on all tables in schema app_verandi to service_role;

/*
 * Tabela técnica, sem dono: não é dado de conta nenhuma, e o resumo do erro pode
 * carregar pedaço de consulta. RLS ligada sem política já recusa quem está
 * logado; o `revoke` é o segundo cadeado, pelo mesmo motivo da 0046 e da 0047.
 */
revoke all on alerta_enviado from anon, authenticated;

/* e o cadeado das tabelas anteriores continua de pé depois do grant acima */
revoke all on evento_saida from anon, authenticated;
revoke all on webhook from anon, authenticated;
revoke all on aceite_de_termos from anon, authenticated;
revoke all on pedido_idempotente from anon, authenticated;
