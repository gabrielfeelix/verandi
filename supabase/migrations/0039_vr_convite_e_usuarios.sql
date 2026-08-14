-- Tudo aqui nasce em `app_verandi`. `public` fica fora do caminho de
-- propósito: é onde o AutoFluxos mora, e nome sem schema não pode cair lá por
-- acidente. Ver 0030.
set search_path = app_verandi, extensions;

/*
 * Convite de acesso e redefinição de senha — o mesmo mecanismo, com propósitos
 * diferentes.
 *
 * Os dois são "um token de vida curta que autoriza definir uma senha". Uma
 * tabela só, porque o ciclo de vida é idêntico: expira, pode ser revogado, é
 * aceito uma vez, e o valor em claro nunca encosta no banco.
 */
alter table convite
  add column tipo text not null default 'acesso'
    check (tipo in ('acesso', 'senha'));

-- o índice de convite pendente por e-mail vale só para acesso: pedir uma
-- redefinição de senha não pode esbarrar num convite de entrada em aberto
drop index if exists convite_pendente_uk;
create unique index convite_pendente_uk on convite (conta_id, lower(email))
  where aceito_em is null and revogado_em is null and tipo = 'acesso';

/*
 * Quem tem acesso à conta, com e-mail e último acesso.
 *
 * `auth.users` não é legível por quem usa o sistema, e nem deveria ser. Em vez
 * de dar a chave de serviço para a tela — que é o atalho que vira vazamento —,
 * esta função roda com os direitos do dono dela e **confere o papel de quem
 * chamou** antes de devolver qualquer coisa.
 *
 * `search_path` fixo: sem isso, `security definer` é a receita clássica de
 * escalada de privilégio por tabela plantada num esquema à frente no caminho.
 */
create or replace function app_verandi.usuarios_da_conta(p_conta uuid)
returns table (
  usuario_id     uuid,
  email          text,
  papel          papel,
  ativo          boolean,
  criado_em      timestamptz,
  ultimo_acesso  timestamptz
)
language sql
security definer
stable
set search_path = app_verandi, auth
as $$
  select uc.usuario_id, u.email::text, uc.papel, uc.ativo, uc.criado_em,
         u.last_sign_in_at
    from app_verandi.usuario_conta uc
    join auth.users u on u.id = uc.usuario_id
   where uc.conta_id = p_conta
     and app_verandi.tem_papel(p_conta, array['dono','suporte']::papel[])
   order by uc.criado_em
$$;

revoke all on function app_verandi.usuarios_da_conta(uuid) from public;
grant execute on function app_verandi.usuarios_da_conta(uuid) to authenticated;

grant select, insert, update, delete on all tables in schema app_verandi to authenticated;
grant all on all tables in schema app_verandi to service_role;
