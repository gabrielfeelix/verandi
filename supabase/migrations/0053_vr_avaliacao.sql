-- Tudo aqui nasce em `app_verandi`. `public` fica fora do caminho de
-- propósito: é onde o AutoFluxos mora, e nome sem schema não pode cair lá por
-- acidente. Ver 0030.
set search_path = app_verandi, extensions;

/*
 * O acompanhamento por foto.
 *
 * O pedido nasceu do pilates, onde a correção postural só se prova comparando a
 * mesma posição em duas datas: a frase "melhorou" não convence ninguém, e a
 * foto lado a lado convence em três segundos. Vale igual para fisioterapia,
 * para estética e para qualquer negócio cujo resultado é visual. O que muda
 * entre eles é a lista de posições, e é por isso que ela é linha da conta e não
 * lista fixa no código.
 *
 * Foto de corpo é dado de saúde. O balde é privado, o caminho começa pela
 * conta, e a recepção não lê. Quem filtra papel é `src/server`, porque papel do
 * produto é linha em `usuario_conta` e não papel do banco, pelo mesmo motivo
 * escrito na 0043.
 */
create table if not exists posicao_avaliacao (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references conta(id) on delete cascade,
  nome text not null,
  ordem int not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (conta_id, nome)
);

comment on table posicao_avaliacao is
  'as posições fotografadas na avaliação, por conta; ver 0053';

create table if not exists avaliacao (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references conta(id) on delete cascade,
  pessoa_id uuid not null references pessoa(id) on delete cascade,
  data date not null,
  profissional_id uuid references profissional(id) on delete set null,
  observacao text,
  criado_por_usuario_id uuid,
  criado_em timestamptz not null default now()
);

/*
 * `on delete set null` no profissional, e não cascade: desativar quem atendeu
 * não pode apagar a avaliação que ele fez. O histórico é da pessoa avaliada,
 * não de quem segurou a câmera.
 */
create index if not exists avaliacao_pessoa_ix on avaliacao (pessoa_id, data desc);

/*
 * Uma foto por posição por avaliação.
 *
 * Repetir a posição na mesma visita não é dado a mais: é a segunda tentativa da
 * mesma foto, e quem compara acaba olhando a errada sem saber que escolheu.
 * Trocar é sobrescrever, e o arquivo velho sai do balde junto.
 *
 * `on delete restrict` na posição: apagar "Frente" com trinta fotos penduradas
 * nela deixaria a matriz com uma coluna órfã. Quem não usa mais desativa.
 */
create table if not exists avaliacao_foto (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references conta(id) on delete cascade,
  avaliacao_id uuid not null references avaliacao(id) on delete cascade,
  posicao_id uuid not null references posicao_avaliacao(id) on delete restrict,
  path text not null,
  observacao text,
  criado_em timestamptz not null default now(),
  unique (avaliacao_id, posicao_id)
);

alter table posicao_avaliacao enable row level security;
alter table avaliacao enable row level security;
alter table avaliacao_foto enable row level security;

create policy posicao_avaliacao_conta on posicao_avaliacao for all
  using (conta_id in (select app_verandi.contas_do_usuario()))
  with check (conta_id in (select app_verandi.contas_do_usuario()));

create policy avaliacao_conta on avaliacao for all
  using (conta_id in (select app_verandi.contas_do_usuario()))
  with check (conta_id in (select app_verandi.contas_do_usuario()));

create policy avaliacao_foto_conta on avaliacao_foto for all
  using (conta_id in (select app_verandi.contas_do_usuario()))
  with check (conta_id in (select app_verandi.contas_do_usuario()));

/*
 * O balde.
 *
 * 5 MB por arquivo, e não os 2 MB da foto de cadastro: a foto de cadastro é
 * um retrato de reconhecimento, e esta é o documento clínico que alguém vai
 * ampliar para procurar um desnível de dois centímetros. Comprimir isso é
 * apagar justamente o que se foi fotografar.
 *
 * O nome do balde vale para o projeto inteiro, que é dividido com o AutoFluxos.
 * `foto-avaliacao` segue o padrão dos dois que já existem, `foto-pessoa` e
 * `foto-profissional`, e não colide com `autofluxos-acervo` nem `logos`.
 */
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'foto-avaliacao', 'foto-avaliacao', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists foto_avaliacao_le on storage.objects;
drop policy if exists foto_avaliacao_escreve on storage.objects;
drop policy if exists foto_avaliacao_atualiza on storage.objects;
drop policy if exists foto_avaliacao_apaga on storage.objects;

/*
 * A recepção fica de fora dos quatro, e isso é decisão de produto, não descuido:
 * quem marca aula não precisa da foto para trabalhar, e o balde é o único lugar
 * onde dá para escrever essa regra em SQL. O resto do filtro por papel mora em
 * `src/server`, porque "recepção" é linha em `usuario_conta` e não papel do
 * Postgres.
 */
create policy foto_avaliacao_le on storage.objects for select
  using (
    bucket_id = 'foto-avaliacao'
    and app_verandi.tem_papel(((storage.foldername(name))[1])::uuid,
                         array['dono','profissional','suporte']::papel[])
  );

create policy foto_avaliacao_escreve on storage.objects for insert
  with check (
    bucket_id = 'foto-avaliacao'
    and app_verandi.tem_papel(((storage.foldername(name))[1])::uuid,
                         array['dono','profissional','suporte']::papel[])
  );

create policy foto_avaliacao_atualiza on storage.objects for update
  using (
    bucket_id = 'foto-avaliacao'
    and app_verandi.tem_papel(((storage.foldername(name))[1])::uuid,
                         array['dono','profissional','suporte']::papel[])
  );

create policy foto_avaliacao_apaga on storage.objects for delete
  using (
    bucket_id = 'foto-avaliacao'
    and app_verandi.tem_papel(((storage.foldername(name))[1])::uuid,
                         array['dono','profissional','suporte']::papel[])
  );

grant select, insert, update, delete on all tables in schema app_verandi to authenticated;
grant all on all tables in schema app_verandi to service_role;
