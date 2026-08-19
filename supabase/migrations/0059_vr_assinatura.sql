-- Tudo aqui nasce em `app_verandi`. `public` fica fora do caminho de
-- propósito: é onde o AutoFluxos mora, e nome sem schema não pode cair lá por
-- acidente. Ver 0030.
set search_path = app_verandi, extensions;

/*
 * A assinatura de quem emite o recibo.
 *
 * O papel saía com uma linha vazia e a palavra "assinatura" embaixo, e alguém
 * do estúdio tinha de assinar à caneta cada via. Isso é aceitável para o recibo
 * impresso e é impossível para o recibo enviado por e-mail: ninguém assina um
 * anexo à caneta antes de mandar.
 *
 * A imagem mora no Storage e não em coluna: é um arquivo, e coluna `bytea`
 * viajaria dentro de cada consulta que lê a conta. O caminho fica em `conta`
 * porque quem emite é a conta, como a razão social e o documento da `0057`.
 *
 * `assinatura_nome` e `assinatura_cargo` existem porque a linha da assinatura
 * precisa dizer **quem** assinou, e nem sempre é a razão social: quem assina é
 * uma pessoa, "Marina Toledo, responsável técnica". Sem isso a imagem seria um
 * rabisco sem dono.
 */
alter table conta add column if not exists assinatura_path text;
alter table conta add column if not exists assinatura_nome text;
alter table conta add column if not exists assinatura_cargo text;

comment on column conta.assinatura_path is
  'caminho no balde assinatura-recibo, no formato <conta_id>/assinatura.<ext>';
comment on column conta.assinatura_nome is
  'quem assina, impresso embaixo da linha; vazio cai na razão social';

/*
 * Balde próprio, e privado.
 *
 * Separado do das fotos pelo mesmo motivo que a foto do aluno é separada da
 * foto da equipe: a política de quem pode ver e trocar uma assinatura não é a
 * mesma de quem pode ver uma foto, e separar depois é mover arquivo de
 * cliente.
 *
 * **Só o dono escreve.** Assinatura é a marca de quem responde pelo negócio, e
 * a recepção emite recibo o dia inteiro sem precisar poder trocá-la. Ler,
 * porém, todo mundo da conta precisa: é a recepção que emite o papel onde ela
 * aparece.
 *
 * SVG fica de fora dos tipos aceitos de propósito: SVG é documento com script,
 * e um balde de imagem que aceita script é um caminho de XSS servido do nosso
 * próprio domínio.
 *
 * **O nome da política leva o nome do balde.** `storage.objects` é global e
 * dividido com o AutoFluxos, e um `drop policy if exists assinatura_le` teria
 * derrubado calado uma política do vizinho que se chamasse igual. As outras
 * três do produto já seguem isso (`foto_pessoa_*`, `foto_profissional_*`).
 */
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'assinatura-recibo', 'assinatura-recibo', false, 1048576,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists assinatura_recibo_le on storage.objects;
drop policy if exists assinatura_recibo_escreve on storage.objects;
drop policy if exists assinatura_recibo_atualiza on storage.objects;
drop policy if exists assinatura_recibo_apaga on storage.objects;

create policy assinatura_recibo_le on storage.objects for select
  using (
    bucket_id = 'assinatura-recibo'
    and ((storage.foldername(name))[1])::uuid in (select app_verandi.contas_do_usuario())
  );

create policy assinatura_recibo_escreve on storage.objects for insert
  with check (
    bucket_id = 'assinatura-recibo'
    and app_verandi.tem_papel(((storage.foldername(name))[1])::uuid,
                         array['dono','suporte']::papel[])
  );

create policy assinatura_recibo_atualiza on storage.objects for update
  using (
    bucket_id = 'assinatura-recibo'
    and app_verandi.tem_papel(((storage.foldername(name))[1])::uuid,
                         array['dono','suporte']::papel[])
  );

create policy assinatura_recibo_apaga on storage.objects for delete
  using (
    bucket_id = 'assinatura-recibo'
    and app_verandi.tem_papel(((storage.foldername(name))[1])::uuid,
                         array['dono','suporte']::papel[])
  );

/*
 * O envio do recibo por e-mail, registrado.
 *
 * Não é log de configuração: é prova de que o comprovante saiu, e para quem.
 * "Eu nunca recebi" é a frase que este registro responde, e ela chega meses
 * depois, quando ninguém lembra. Guarda o endereço como estava no dia, porque
 * o e-mail da ficha muda.
 *
 * Uma linha por envio, e não uma coluna `enviado_em` no recibo: reenviar é
 * normal, e sobrescrever a data apagaria justamente o histórico que a pergunta
 * exige.
 */
create table if not exists envio_de_recibo (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references conta(id) on delete cascade,
  recibo_id uuid not null references recibo(id) on delete cascade,
  para text not null,
  enviado_em timestamptz not null default now(),
  enviado_por_usuario_id uuid references auth.users(id) on delete set null,
  /* `false` quando o provedor recusou: o registro fica, com a falha à vista */
  entregue boolean not null default true,
  erro text
);

create index if not exists envio_de_recibo_recibo
  on envio_de_recibo (recibo_id, enviado_em desc);

comment on table envio_de_recibo is
  'cada vez que um recibo foi enviado por e-mail, e para qual endereço';

alter table envio_de_recibo enable row level security;

drop policy if exists envio_de_recibo_conta on envio_de_recibo;

create policy envio_de_recibo_conta on envio_de_recibo for all
  using (conta_id in (select app_verandi.contas_do_usuario()))
  with check (conta_id in (select app_verandi.contas_do_usuario()));

/*
 * O log passa a aceitar a entidade nova na mesma migration que a cria, que é a
 * lição que a `0056` deixou: `registrar()` engole o erro de propósito, e a
 * linha sumia calada quando o `check` não conhecia a palavra.
 */
alter table log_configuracao drop constraint if exists log_configuracao_entidade_check;
alter table log_configuracao
  add constraint log_configuracao_entidade_check check (entidade in
    ('serie','servico','profissional','local','vocabulario',
     'funcionamento','excecao_calendario','usuario_conta','convite','conta',
     'pessoa','chave_api','webhook','plano','contrato','cobranca','pagamento',
     'recibo','envio_de_recibo'));
