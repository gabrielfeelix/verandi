-- O nome de quem usa o sistema.
--
-- Até aqui a Verandi só sabia o e-mail de quem entra. A tela de Hoje
-- cumprimentava com o pedaço antes da arroba ("Bom dia, dono-17909..."), e a
-- lista de usuários mostrava o mesmo pedaço como nome. O profissional tinha
-- nome porque tem cadastro na grade; o dono e a recepção, não.
--
-- O nome mora no vínculo com a conta, e não no `auth.users`: o Auth é global
-- ao projeto e compartilhado com o AutoFluxos, e o metadado dele não é lugar
-- para dado de um produto só.
--
-- Quem convida escreve o nome no convite; quem aceita confirma. A pessoa muda o
-- próprio nome pela função abaixo, que só alcança a coluna `nome` da própria
-- linha: a política de escrita de `usuario_conta` continua só do dono, porque
-- é ela que protege o papel.
set search_path = app_verandi, extensions;

alter table usuario_conta add column if not exists nome text
  check (nome is null or char_length(btrim(nome)) between 1 and 80);

alter table convite add column if not exists nome text
  check (nome is null or char_length(btrim(nome)) between 1 and 80);

create or replace function app_verandi.definir_meu_nome(p_conta uuid, p_nome text)
returns void
language plpgsql
security definer
set search_path = app_verandi, pg_temp
as $$
declare
  v_nome text := nullif(btrim(p_nome), '');
begin
  if v_nome is null or char_length(v_nome) > 80 then
    raise exception 'nome precisa ter de 1 a 80 letras';
  end if;
  update app_verandi.usuario_conta
     set nome = v_nome
   where usuario_id = auth.uid()
     and conta_id = p_conta
     and ativo;
  if not found then
    raise exception 'sem acesso a esta conta';
  end if;
end;
$$;

revoke all on function app_verandi.definir_meu_nome(uuid, text) from public, anon;
grant execute on function app_verandi.definir_meu_nome(uuid, text) to authenticated;
