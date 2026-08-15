-- Tudo aqui nasce em `app_verandi`. `public` fica fora do caminho de
-- propósito: é onde o AutoFluxos mora, e nome sem schema não pode cair lá por
-- acidente. Ver 0030.
set search_path = app_verandi, extensions;

/*
 * A observação da ficha ganha o mesmo "visível para" que a da participação.
 *
 * A 0043 resolveu metade do problema. `participacao.observacao` é o que se
 * escreve durante a chamada, "chegou 10 min atrasada"; `pessoa.observacao` é a
 * faixa "Atenção na aula" que fica na ficha, aberta o tempo todo, e é
 * **justamente ali** que alguém escreve "hérnia de disco, não pode carga
 * axial". Dado de saúde (LGPD art. 11) numa caixa que a recepção lê inteira.
 *
 * Fechar metade do vazamento não fecha vazamento nenhum: quem escreveu a frase
 * restrita na chamada escreve a mesma frase na ficha no dia seguinte, porque a
 * ficha é o lugar onde ela vale para sempre e a chamada é onde ela vale para
 * hoje.
 *
 * O padrão fecha, pelo mesmo motivo da 0043: quem anota entre uma turma e
 * outra não volta para restringir depois, e o erro de deixar aberto é o único
 * dos dois que não tem volta.
 *
 * A conta existente não perde nada e não vaza mais: o `default` fecha as
 * observações que já estão escritas. Uma anotação que hoje todo mundo lê passa
 * a ser só de quem atende, e é essa a direção segura do erro. Quem quiser
 * abrir de novo abre em um clique, na tela de edição.
 */

alter table pessoa
  add column observacao_visivel text not null default 'profissionais'
    check (observacao_visivel in ('profissionais', 'todos'));

comment on column pessoa.observacao_visivel is
  'quem lê `observacao` da ficha: só quem atende, ou todo mundo da conta. '
  'Mesma régua de participacao.observacao_visivel (0043), e mesmo padrão '
  'fechado: dado de saúde escrito às pressas não se desvaza depois';

/*
 * A separação continua **não** sendo RLS, e continua sendo decisão.
 *
 * RLS é por linha; esconder uma coluna de um papel seria privilégio de coluna,
 * e privilégio no Postgres é por papel do banco. Todo usuário logado é o mesmo
 * `authenticated`, e "recepção" é uma linha em `usuario_conta`. Quem filtra é
 * `src/server`, que é o único caminho até o dado. O porquê inteiro está na
 * 0043 e no ESTADO.md.
 */

/*
 * A view nasce de novo para enxergar a coluna: o `select p.nome, ...` foi
 * expandido no `create view`, e coluna nova na tabela não aparece sozinha ali.
 * É a mesma armadilha da 0043, e é por isso que este arquivo repete a view
 * inteira em vez de "só" adicionar a coluna.
 *
 * `security_invoker` é obrigatório: sem ele a view roda com os direitos de
 * quem a criou e passa por cima da RLS, vazando pessoa entre contas.
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
  p.observacao_visivel,
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

/*
 * GRANT é camada separada de RLS. Coluna nova não muda privilégio de tabela,
 * mas o bloco fica em toda migration para ninguém precisar lembrar quando a
 * próxima criar tabela.
 */
grant select, insert, update, delete on all tables in schema app_verandi to authenticated;
grant all on all tables in schema app_verandi to service_role;
