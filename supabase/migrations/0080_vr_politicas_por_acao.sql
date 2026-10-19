-- Uma política por ação, e `auth.uid()` avaliado uma vez por consulta.
--
-- Dezoito tabelas tinham `X_le` (select) e `X_escreve` (`for all`). No select
-- as duas valiam juntas, e o Postgres avaliava `tem_papel` linha a linha só
-- para chegar à mesma resposta: `X_escreve` exige papel ativo na conta, o que
-- já põe a conta em `contas_do_usuario()`, e `X_le` já deixava ver. O painel
-- contou 126 avisos `multiple_permissive_policies` em 19/out/2026 (18 tabelas
-- vezes 7 papéis).
--
-- `X_escreve` vira `X_insere`, `X_atualiza` e `X_apaga`, cada uma com a
-- expressão exata que estava lá, lida do catálogo. Quem podia escrever segue
-- podendo, quem não podia segue sem poder, e o select fica só com `X_le`. As
-- linhas visíveis não mudam: tudo que `X_escreve` deixava ver, `X_le` já
-- deixava.
--
-- As seis políticas que chamavam `auth.uid()` direto passam a chamar
-- `(select auth.uid())`: mesmo resultado, avaliado uma vez por consulta em vez
-- de uma vez por linha (aviso `auth_rls_initplan`).
--
-- Tabela nova com `for all` volta a gerar o aviso: o padrão daqui em diante é
-- uma política por ação.

set search_path = app_verandi, extensions;

do $$
declare
  t record;
  base text;
  expr text;
begin
  for t in
    select tablename, policyname, qual, with_check, cmd
      from pg_policies
     where schemaname = 'app_verandi'
       and policyname in (
         'convite_escreve', 'espera_escreve', 'excecao_escreve',
         'funcionamento_escreve', 'licenca_escreve', 'local_escreve',
         'participacao_escreve', 'pendencia_dispensada_escreve',
         'pessoa_escreve', 'pessoa_tag_escreve', 'profissional_escreve',
         'profissional_servico_escreve', 'serie_escreve', 'servico_escreve',
         'sessao_escreve', 'usuario_conta_escreve', 'vaga_escreve',
         'vocabulario_escreve')
  loop
    -- só desmonta o que tem a forma esperada; qualquer outra coisa para tudo
    if t.cmd <> 'ALL' or t.qual is null or t.qual is distinct from t.with_check then
      raise exception 'política % fora do esperado (cmd %, using e check diferentes)', t.policyname, t.cmd;
    end if;

    base := regexp_replace(t.policyname, '_escreve$', '');
    expr := t.qual;

    execute format('drop policy %I on app_verandi.%I', t.policyname, t.tablename);
    execute format('create policy %I on app_verandi.%I for insert with check (%s)', base || '_insere', t.tablename, expr);
    execute format('create policy %I on app_verandi.%I for update using (%s) with check (%s)', base || '_atualiza', t.tablename, expr, expr);
    execute format('create policy %I on app_verandi.%I for delete using (%s)', base || '_apaga', t.tablename, expr);
  end loop;

  if (select count(*) from pg_policies where schemaname = 'app_verandi' and policyname like '%\_escreve' escape '\' and cmd = 'ALL') > 0 then
    raise exception 'sobrou política for all de escrita';
  end if;
end
$$;

alter policy usuario_conta_le on app_verandi.usuario_conta
  using ((usuario_id = (select auth.uid()))
         or app_verandi.tem_papel(conta_id, array['dono', 'suporte']::app_verandi.papel[]));

alter policy log_configuracao_escreve on app_verandi.log_configuracao
  with check (app_verandi.tem_papel(conta_id, array['dono', 'recepcao', 'suporte']::app_verandi.papel[])
              and por_usuario_id = (select auth.uid()));

alter policy acesso_suporte_escreve on app_verandi.acesso_suporte
  with check (app_verandi.tem_papel(conta_id, array['suporte']::app_verandi.papel[])
              and usuario_id = (select auth.uid()));

alter policy acesso_suporte_encerra on app_verandi.acesso_suporte
  using (app_verandi.tem_papel(conta_id, array['suporte']::app_verandi.papel[])
         and usuario_id = (select auth.uid()))
  with check (app_verandi.tem_papel(conta_id, array['suporte']::app_verandi.papel[])
              and usuario_id = (select auth.uid()));

alter policy onboarding_meu on app_verandi.onboarding
  using (usuario_id = (select auth.uid())
         and conta_id in (select app_verandi.contas_do_usuario()))
  with check (usuario_id = (select auth.uid())
              and conta_id in (select app_verandi.contas_do_usuario()));

alter policy preferencia_home_propria on app_verandi.preferencia_home
  using (conta_id in (select app_verandi.contas_do_usuario())
         and usuario_id = (select auth.uid()))
  with check (conta_id in (select app_verandi.contas_do_usuario())
              and usuario_id = (select auth.uid()));
