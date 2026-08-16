-- Tudo aqui nasce em `app_verandi`. `public` fica fora do caminho de
-- propósito: é onde o AutoFluxos mora, e nome sem schema não pode cair lá por
-- acidente. Ver 0030.
set search_path = app_verandi, extensions;

/*
 * A foto da pessoa.
 *
 * Em pilates, fisioterapia e estética a foto não é enfeite de cadastro: é o
 * antes e depois da correção postural, e é o que faz a recepção reconhecer
 * quem chegou sem perguntar o nome. A equipe já tinha a dela desde a `0038`;
 * esta é a mesma coisa do outro lado do balcão.
 *
 * Um balde separado, e não a mesma pasta da equipe: a política de leitura da
 * foto de aluno é a da conta inteira, mas o dia em que a recepção puder ver a
 * equipe e não os alunos (ou o contrário) chega sem aviso, e separar depois é
 * mover arquivo de cliente.
 *
 * Quem escreve inclui `recepcao`: cadastrar aluno é trabalho dela, e foto faz
 * parte do cadastro. A equipe é só do dono, porque mexer em quem atende é
 * outra conversa.
 */
alter table pessoa
  add column if not exists foto_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'foto-pessoa', 'foto-pessoa', false, 2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists foto_pessoa_le on storage.objects;
drop policy if exists foto_pessoa_escreve on storage.objects;
drop policy if exists foto_pessoa_atualiza on storage.objects;
drop policy if exists foto_pessoa_apaga on storage.objects;

create policy foto_pessoa_le on storage.objects for select
  using (
    bucket_id = 'foto-pessoa'
    and ((storage.foldername(name))[1])::uuid in (select app_verandi.contas_do_usuario())
  );

create policy foto_pessoa_escreve on storage.objects for insert
  with check (
    bucket_id = 'foto-pessoa'
    and app_verandi.tem_papel(((storage.foldername(name))[1])::uuid,
                         array['dono','recepcao','suporte']::papel[])
  );

create policy foto_pessoa_atualiza on storage.objects for update
  using (
    bucket_id = 'foto-pessoa'
    and app_verandi.tem_papel(((storage.foldername(name))[1])::uuid,
                         array['dono','recepcao','suporte']::papel[])
  );

create policy foto_pessoa_apaga on storage.objects for delete
  using (
    bucket_id = 'foto-pessoa'
    and app_verandi.tem_papel(((storage.foldername(name))[1])::uuid,
                         array['dono','recepcao','suporte']::papel[])
  );

/*
 * A view é lista de colunas, não `p.*`: coluna nova só chega à ficha quando a
 * view é reescrita. Ver `0044`, de onde esta é cópia com uma linha a mais.
 */
create or replace view pessoa_resumo with (security_invoker = true) as
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
      and pa.status = 'presente') as ultima_presenca,
  -- no fim da lista de propósito: `create or replace view` recusa coluna
  -- nova no meio, e renomear as de baixo seria quebrar quem lê por nome
  p.foto_path
from pessoa p;

grant select on pessoa_resumo to authenticated, service_role;

grant select, insert, update, delete on all tables in schema app_verandi to authenticated;
grant all on all tables in schema app_verandi to service_role;
