-- Travas no banco para o que a sessão do usuário não pode gravar pela API, e o
-- contador do limite de pedidos da API v1.
--
-- A auditoria de 19/out/2026 achou o caminho: `app_verandi` está exposto na
-- Data API, a chave publicável é pública, e as políticas de `convite`, `conta`
-- e `usuario_conta` só conferiam o papel de quem grava, não o que era gravado.
-- Um dono podia, com o próprio login e sem passar pelas telas:
--
-- - criar convite do tipo `senha` com o e-mail de qualquer pessoa e, ao
--   aceitar, trocar a senha dela (inclusive de um admin da 4YU). O aceite já
--   confere isso desde o mesmo dia; aqui o banco também recusa;
-- - reativar a própria conta suspensa (`conta.ativo`);
-- - dar a si mesmo o papel `suporte`, que passa por cima da suspensão.
--
-- Os gatilhos só agem quando quem grava é a sessão (`authenticated`). O
-- servidor, com a chave de serviço, segue gravando o que as telas de admin e
-- de suporte precisam, depois das conferências dele. Nenhuma tela da Verandi
-- grava esses campos pela sessão (conferido no código em 19/out): convite pela
-- sessão só é criado do tipo `acesso` e só é revogado.

set search_path = app_verandi, extensions;

create or replace function app_verandi.trava_convite_da_sessao()
returns trigger
language plpgsql
set search_path = app_verandi, pg_temp
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.tipo <> 'acesso' then
      raise exception 'convite de senha só é criado pelo servidor' using errcode = '42501';
    end if;
    if new.papel = 'suporte' and not exists (
      select 1 from app_verandi.conta c where c.id = new.conta_id and c.interna
    ) then
      raise exception 'o papel suporte só existe na conta da 4YU' using errcode = '42501';
    end if;
    return new;
  end if;

  -- pela sessão, convite só pode ser revogado
  if (new.conta_id, new.email, new.papel, new.tipo, new.token_hash, new.expira_em,
      new.aceito_em, new.aceito_por_usuario_id)
     is distinct from
     (old.conta_id, old.email, old.papel, old.tipo, old.token_hash, old.expira_em,
      old.aceito_em, old.aceito_por_usuario_id) then
    raise exception 'pela sessão, um convite só pode ser revogado' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists convite_trava_da_sessao on app_verandi.convite;
create trigger convite_trava_da_sessao
  before insert or update on app_verandi.convite
  for each row execute function app_verandi.trava_convite_da_sessao();

create or replace function app_verandi.trava_conta_da_sessao()
returns trigger
language plpgsql
set search_path = app_verandi, pg_temp
as $$
begin
  if current_user = 'authenticated'
     and (new.ativo, new.interna) is distinct from (old.ativo, old.interna) then
    raise exception 'suspender, reativar e marcar conta interna é com a 4YU' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists conta_trava_da_sessao on app_verandi.conta;
create trigger conta_trava_da_sessao
  before update on app_verandi.conta
  for each row execute function app_verandi.trava_conta_da_sessao();

create or replace function app_verandi.trava_papel_da_sessao()
returns trigger
language plpgsql
set search_path = app_verandi, pg_temp
as $$
begin
  if current_user = 'authenticated'
     and new.papel = 'suporte'
     and (tg_op = 'INSERT' or old.papel is distinct from 'suporte')
     and not exists (
       select 1 from app_verandi.conta c where c.id = new.conta_id and c.interna
     ) then
    raise exception 'o papel suporte só existe na conta da 4YU' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists usuario_conta_trava_da_sessao on app_verandi.usuario_conta;
create trigger usuario_conta_trava_da_sessao
  before insert or update on app_verandi.usuario_conta
  for each row execute function app_verandi.trava_papel_da_sessao();

revoke all on function app_verandi.trava_convite_da_sessao() from public, anon, authenticated;
revoke all on function app_verandi.trava_conta_da_sessao() from public, anon, authenticated;
revoke all on function app_verandi.trava_papel_da_sessao() from public, anon, authenticated;

-- Limite de pedidos da API v1 (`src/server/api/rota.ts`). Contado no banco
-- porque na Vercel cada instância nasce zerada. Só o servidor chama.

create table if not exists app_verandi.limite_de_pedido (
  chave text primary key,
  inicio_da_janela timestamptz not null,
  tentativas integer not null
);

alter table app_verandi.limite_de_pedido enable row level security;
revoke all on table app_verandi.limite_de_pedido from public, anon, authenticated;
grant select, insert, update, delete on table app_verandi.limite_de_pedido to service_role;

create or replace function app_verandi.consumir_limite(
  p_chave text, p_teto integer, p_janela_segundos integer
)
returns boolean
language plpgsql
set search_path = app_verandi, pg_temp
as $$
declare
  permitido boolean;
begin
  if p_chave = '' or p_teto < 1 or p_janela_segundos < 1 then
    raise exception 'parâmetros de limite inválidos';
  end if;

  insert into app_verandi.limite_de_pedido as limite (chave, inicio_da_janela, tentativas)
  values (p_chave, clock_timestamp(), 1)
  on conflict (chave) do update
  set
    inicio_da_janela = case
      when limite.inicio_da_janela <= clock_timestamp() - make_interval(secs => p_janela_segundos)
        then clock_timestamp()
      else limite.inicio_da_janela
    end,
    tentativas = case
      when limite.inicio_da_janela <= clock_timestamp() - make_interval(secs => p_janela_segundos)
        then 1
      else limite.tentativas + 1
    end
  returning tentativas <= p_teto into permitido;

  return permitido;
end;
$$;

revoke all on function app_verandi.consumir_limite(text, integer, integer) from public, anon, authenticated;
grant execute on function app_verandi.consumir_limite(text, integer, integer) to service_role;
