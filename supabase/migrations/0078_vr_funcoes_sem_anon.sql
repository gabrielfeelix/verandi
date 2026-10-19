-- Tira `anon` das três funções `security definer` que ele ainda executava.
--
-- `tem_papel`, `contas_do_usuario` e `proximo_numero_recibo` nasceram com o
-- `EXECUTE` que o Postgres concede a `PUBLIC` em toda função nova, e `anon`
-- herda de lá. O default do schema concede a `authenticated` e
-- `service_role`, mas default por schema só acrescenta, nunca tira o global.
-- O aviso do painel de 19/out/2026 apontou as três.
--
-- Sem sessão, `auth.uid()` é nulo e as três já respondiam vazio ou erro, então
-- nada vazava. Fechar tira a porta de quem não tem motivo para usá-la: a
-- Verandi chama as três sempre com usuário logado, e nenhum fluxo usa o
-- Storage sem sessão. Pedido anônimo ao Storage passa a receber erro de
-- permissão nas políticas que chamam `tem_papel`/`contas_do_usuario`, em vez
-- de lista vazia.
--
-- `authenticated` continua executando as seis funções `security definer` de
-- propósito: todas conferem `auth.uid()` por dentro.

set search_path = app_verandi, extensions;

revoke all on function app_verandi.tem_papel(uuid, app_verandi.papel[]) from public, anon;
revoke all on function app_verandi.contas_do_usuario() from public, anon;
revoke all on function app_verandi.proximo_numero_recibo(uuid, text) from public, anon;

grant execute on function app_verandi.tem_papel(uuid, app_verandi.papel[]) to authenticated, service_role;
grant execute on function app_verandi.contas_do_usuario() to authenticated, service_role;
grant execute on function app_verandi.proximo_numero_recibo(uuid, text) to authenticated, service_role;
