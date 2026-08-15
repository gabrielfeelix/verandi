-- Tudo aqui nasce em `app_verandi`. `public` fica fora do caminho de
-- propósito: é onde o AutoFluxos mora, e nome sem schema não pode cair lá por
-- acidente. Ver 0030.
set search_path = app_verandi, extensions;

/*
 * O registro de que alguém aceitou os termos.
 *
 * A frase "ao criar sua senha, você concorda com os Termos de uso" é aceite
 * válido, e é mais forte que link solto no rodapé. Mas ela só vale como prova
 * se existir o registro do que foi aceito, e é aí que quase todo produto
 * pequeno descobre que não tem nada: guarda "aceitou" e não guarda **qual
 * versão** estava no ar naquele segundo.
 *
 * Sem a versão, a afirmação é circular. O texto muda, a página passa a mostrar
 * outra coisa, e não sobra como dizer a que a pessoa aderiu. Por isso a versão é
 * coluna, e por isso as versões antigas precisam continuar publicadas: registro
 * que aponta para documento que não existe mais é registro sem lastro.
 *
 * O endereço de rede e o agente do navegador entram pelo mesmo motivo: são o que
 * transforma "consta no nosso banco" em algo conferível por quem não confia no
 * nosso banco.
 */
create table aceite_de_termos (
  id         uuid primary key default gen_random_uuid(),

  usuario_id uuid not null references auth.users (id) on delete cascade,

  /*
   * Anulável, e isso é decisão. No convite sabemos a conta; ao entrar, não:
   * quem tem acesso a dois estúdios só escolhe a conta depois. O aceite é da
   * pessoa com a 4YU, não da conta com a 4YU, então faltar a conta não invalida
   * nada, e ter a conta ajuda a achar o registro depois.
   */
  conta_id   uuid references conta (id) on delete set null,

  documento  text not null check (documento in ('termos', 'privacidade')),

  /*
   * A versão do documento, como ela aparece na tela. Texto, e não número, porque
   * é o mesmo valor que `src/core/legal/comum.ts` publica: se um dia virar
   * "1.1-a", o registro continua dizendo a verdade.
   */
  versao     text not null,

  /* por onde a pessoa passou: criar a senha do convite, ou entrar */
  origem     text not null check (origem in ('convite', 'entrada')),

  ip         text,
  agente     text,

  aceito_em  timestamptz not null default now()
);

/*
 * Aceitar a mesma versão duas vezes não acrescenta prova nenhuma, e sem esta
 * chave todo login gravaria uma linha: em um ano, milhares de linhas dizendo a
 * mesma coisa sobre a mesma pessoa. Versão nova é linha nova, que é justamente o
 * que se quer registrar.
 */
create unique index aceite_de_termos_uk
  on aceite_de_termos (usuario_id, documento, versao);

create index aceite_de_termos_conta_ix
  on aceite_de_termos (conta_id, aceito_em desc);

comment on table aceite_de_termos is
  'prova de aceite dos documentos publicados: quem, quando, de onde e qual '
  'versão. Só o servidor escreve e lê; não é dado de conta de cliente';

alter table aceite_de_termos enable row level security;

/*
 * GRANT é camada separada de RLS: tabela criada por migration não recebe
 * privilégio sozinha, e sem isto até um `select` legítimo leva 42501. Se o erro
 * for 42501, olhe o grant antes da política.
 */
grant select, insert, update, delete on all tables in schema app_verandi to authenticated;
grant all on all tables in schema app_verandi to service_role;

/*
 * E agora a parte que o bloco acima acabou de desfazer, de propósito nesta
 * ordem.
 *
 * O `alter default privileges` da 0030 e o `grant ... on all tables` acima
 * concedem a `authenticated` tudo que nasce aqui, inclusive esta tabela. Foi
 * assim que a `migrations_aplicadas` nasceu com `delete` liberado para qualquer
 * usuário logado de qualquer cliente.
 *
 * Esta tabela **não é dado de conta**: é a prova que a 4YU guarda de que alguém
 * aceitou um documento dela. RLS ligada sem política nenhuma já recusa o acesso
 * de quem está logado; o `revoke` é o segundo cadeado, para o caso de alguém
 * criar uma política aqui um dia sem pensar duas vezes. `service_role`, que é
 * quem o servidor usa, passa por cima dos dois.
 */
revoke all on aceite_de_termos from anon, authenticated;
