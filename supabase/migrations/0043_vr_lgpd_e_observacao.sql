-- Tudo aqui nasce em `app_verandi`. `public` fica fora do caminho de
-- propósito: é onde o AutoFluxos mora, e nome sem schema não pode cair lá por
-- acidente. Ver 0030.
set search_path = app_verandi, extensions;

/*
 * Duas decisões de modelo que valem antes do primeiro cliente, e que ficam
 * caras depois: o direito do titular do dado, e quem enxerga a observação.
 *
 * As duas têm a mesma raiz. Guardamos nome, telefone e anotação de gente que
 * nunca consentiu com a 4YU: quem coletou foi o cliente. Somos operador, ele é
 * controlador, e o sistema precisa dar a ele o que a lei manda entregar sem
 * exigir que ele destrua o próprio histórico para conseguir.
 */

-- ---------------------------------------------------------------------------
-- 1. Direito do titular: anonimizar, não apagar
-- ---------------------------------------------------------------------------

/*
 * `delete` em `pessoa` leva `participacao` por cascade, e com ela some a
 * presença de todo mundo naquela turma, a ocupação de fevereiro e a contagem
 * que o negócio usa para se defender. Quem pediu para sair tem direito aos
 * dados **dela**, não ao registro de operação de terceiros.
 *
 * Então a linha fica e os campos que identificam alguém são zerados. É o que a
 * LGPD chama de anonimização (art. 12): sem meio razoável de reverter, o dado
 * deixa de ser pessoal, e o histórico continua contável.
 *
 * A coluna existe para a tela poder dizer o que aconteceu, e para ninguém
 * "consertar" o cadastro digitando o nome de volta. Sem ela, uma pessoa
 * anonimizada é indistinguível de um cadastro mal preenchido.
 */
alter table pessoa
  add column anonimizada_em timestamptz;

comment on column pessoa.anonimizada_em is
  'quando o titular pediu a exclusão e os dados dela foram zerados; a linha '
  'continua para o histórico de participação não abrir buraco';

-- ---------------------------------------------------------------------------
-- 2. Observação de participação: quem enxerga
-- ---------------------------------------------------------------------------

/*
 * "Chegou 10 min atrasada, avisou antes" e "lesão no ombro esquerdo" moram na
 * mesma caixa de texto, e são coisas diferentes. A segunda é dado de saúde
 * (LGPD art. 11, dado sensível), e recepção ler tudo é problema jurídico antes
 * de ser de gosto. Isto vira pré-requisito no primeiro cliente de clínica, e
 * coluna nova depois que há observação escrita custa muito mais.
 *
 * **O padrão fecha.** Quem escreve às pressas entre uma turma e outra não vai
 * lembrar de restringir depois, e o erro de deixar aberto é o que não tem
 * volta. Quem quiser que a recepção leia marca na hora de escrever, que é o
 * momento em que a pessoa sabe o que está escrevendo.
 *
 * Texto com `check`, e não `enum`: são dois valores, e enum novo custa um tipo
 * a mais para o mesmo resultado.
 */
alter table participacao
  add column observacao_visivel text not null default 'profissionais'
    check (observacao_visivel in ('profissionais', 'todos'));

comment on column participacao.observacao_visivel is
  'quem lê `observacao`: só quem atende, ou todo mundo da conta. O padrão '
  'fecha porque dado de saúde escrito às pressas não se desvaza depois';

/*
 * A separação **não** é RLS, e isto é decisão, não esquecimento.
 *
 * RLS é por linha; esconder uma coluna de um papel e não de outro seria
 * privilégio de coluna, e privilégio no Postgres é por papel do banco. Aqui
 * todo usuário logado é o mesmo `authenticated`, e o papel do produto (dono,
 * recepção, profissional) é uma linha em `usuario_conta`, não um papel do
 * banco. Não existe política que expresse isto.
 *
 * Quem filtra é `src/server`, que é o único caminho até o dado: o cliente do
 * navegador nunca fala com o PostgREST. Está anotado no ESTADO.md junto das
 * outras armadilhas, e vira RLS de verdade no dia em que existir view por
 * papel.
 */

/*
 * A view precisa nascer de novo para enxergar a coluna: `select p.nome, ...`
 * foi expandido no `create view` da 0034, e coluna nova na tabela não aparece
 * sozinha ali. Vai junto a correção de `reposicoes_abertas`, que contava só
 * falta e ignorava a participação cancelada pelo próprio negócio — o mesmo
 * crédito que `/pendencias` passou a cobrar.
 *
 * `security_invoker` é obrigatório: sem ele a view roda com os direitos de quem
 * a criou e passa por cima da RLS, vazando pessoa entre contas.
 */
drop view pessoa_resumo;

create view pessoa_resumo with (security_invoker = true) as
select
  p.id,
  p.conta_id,
  p.nome,
  p.nome_busca,
  p.telefone,
  p.email,
  p.identificador_externo,
  p.nascimento,
  p.vencimento_plano,
  p.observacao,
  p.ativo,
  p.anonimizada_em,
  p.criado_em,
  (select count(*)
     from vaga v
    where v.pessoa_id = p.id
      and (v.fim is null or v.fim >= current_date)) as vagas_ativas,
  -- falta é falta: dia que o negócio fechou não entra aqui, senão a leitura
  -- "está sumindo" acusa quem não faltou
  (select count(*)
     from participacao pa
     join sessao s on s.id = pa.sessao_id
    where pa.pessoa_id = p.id
      and pa.status in ('falta', 'falta_avisada')
      and s.inicio >= now() - interval '30 days') as faltas_recentes,
  -- o que gerou crédito e ninguém usou ainda, incluindo o dia cancelado
  (select count(*)
     from participacao pa
    where pa.pessoa_id = p.id
      and pa.status in ('falta', 'falta_avisada', 'cancelada')
      and not exists (select 1 from participacao r where r.reposicao_de_id = pa.id)
  ) as reposicoes_abertas,
  (select max(s.inicio)
     from participacao pa
     join sessao s on s.id = pa.sessao_id
    where pa.pessoa_id = p.id
      and pa.status = 'presente') as ultima_presenca
from pessoa p;

grant select on pessoa_resumo to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. O log precisa saber falar de pessoa
-- ---------------------------------------------------------------------------

/*
 * Anonimizar é irreversível e é obrigação legal cumprida: precisa ficar
 * registrado quem fez e quando, com a mesma consulta que responde "o que
 * aconteceu nesta conta". O `check` da 0036 não previa `pessoa` nem
 * `anonimizou`, e checagem de texto é lista fechada por decisão, então cresce
 * na mão.
 *
 * `entidade_id` fica com o id da pessoa de propósito: sem ele, ninguém prova
 * depois que o pedido daquele titular foi atendido. O nome **não** entra em
 * `detalhe`, senão o log vira a cópia do dado que a linha acabou de apagar.
 */
alter table log_configuracao
  drop constraint log_configuracao_entidade_check,
  add constraint log_configuracao_entidade_check check (entidade in
    ('serie','servico','profissional','local','vocabulario',
     'funcionamento','excecao_calendario','usuario_conta','convite','conta',
     'pessoa'));

alter table log_configuracao
  drop constraint log_configuracao_acao_check,
  add constraint log_configuracao_acao_check check (acao in
    ('criou','editou','duplicou','encerrou','desativou','reativou','removeu',
     'anonimizou'));

/*
 * GRANT é camada separada de RLS. Coluna nova não muda privilégio de tabela,
 * mas o bloco fica em toda migration para ninguém precisar lembrar quando a
 * próxima criar tabela.
 */
grant select, insert, update, delete on all tables in schema app_verandi to authenticated;
grant all on all tables in schema app_verandi to service_role;
