-- Tudo aqui nasce em `app_verandi`. Ver 0030.
set search_path = app_verandi, extensions;

/*
 * O arranjo da tela inicial, por pessoa.
 *
 * Por **usuário e conta**, e não por conta, porque a home do dono e a da
 * recepção respondem perguntas diferentes: ele abre o dia para saber quanto
 * entrou, ela abre para saber quem falta chamar. Guardar um arranjo só por
 * conta faria a última pessoa a mexer decidir pela outra, todo dia.
 *
 * O conteúdo é um `jsonb` com a lista ordenada de blocos e se cada um aparece.
 * Coluna por bloco daria uma migration a cada bloco novo, e ordem não cabe em
 * coluna booleana. O que o banco garante é a forma mínima (é um array); qual
 * bloco existe é assunto de `core/home/blocos.ts`, que ignora o que não
 * conhece e acrescenta o que faltar. Assim um arranjo salvo hoje continua
 * válido depois de a tela ganhar um bloco novo, sem migration corretiva.
 */
create table if not exists preferencia_home (
  conta_id uuid not null references conta(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  blocos jsonb not null default '[]'::jsonb,
  atualizado_em timestamptz not null default now(),
  primary key (conta_id, usuario_id),
  constraint preferencia_home_blocos_array check (jsonb_typeof(blocos) = 'array')
);

comment on table preferencia_home is
  'ordem e visibilidade dos blocos da tela inicial, por usuário e conta';

alter table preferencia_home enable row level security;

/*
 * Isolamento por conta **e** por pessoa.
 *
 * As outras tabelas param na conta porque o dado é do negócio. Este é da
 * pessoa: quem divide a conta não tem por que ler, e muito menos escrever, o
 * arranjo de tela de quem senta ao lado.
 */
create policy preferencia_home_propria on preferencia_home for all
  using (
    conta_id in (select app_verandi.contas_do_usuario())
    and usuario_id = auth.uid()
  )
  with check (
    conta_id in (select app_verandi.contas_do_usuario())
    and usuario_id = auth.uid()
  );
