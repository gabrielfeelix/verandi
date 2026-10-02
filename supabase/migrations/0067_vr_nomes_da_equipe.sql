-- Os nomes da equipe, para quem é da equipe.
--
-- O histórico da sessão dizia "pela equipe" para recepção e profissional
-- porque a RLS da 0031 só deixa cada um ler a própria linha de
-- `usuario_conta`. Abrir a tabela inteira entregaria e-mail e papel de todo
-- mundo; esta função devolve só o nome, e só a quem é membro ativo da conta.

set search_path = app_verandi, extensions;

create or replace function app_verandi.nomes_da_equipe(p_conta uuid)
returns table (usuario_id uuid, nome text)
language sql
stable
security definer
set search_path = app_verandi, pg_temp
as $$
  select uc.usuario_id, uc.nome
    from app_verandi.usuario_conta uc
   where uc.conta_id = p_conta
     and uc.nome is not null
     and exists (
       select 1 from app_verandi.usuario_conta eu
        where eu.conta_id = p_conta
          and eu.usuario_id = auth.uid()
          and eu.ativo
     );
$$;

revoke all on function app_verandi.nomes_da_equipe(uuid) from public, anon;
grant execute on function app_verandi.nomes_da_equipe(uuid) to authenticated;
