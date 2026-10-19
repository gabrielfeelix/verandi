-- Escrever no financeiro passa a exigir papel no banco, e não só no código.
--
-- A revisão de 19/out/2026 achou: `plano`, `contrato`, `pausa`, `cobranca`,
-- `pagamento` e `recibo` tinham uma política `for all` que aceitava qualquer
-- membro da conta. Quem restringia por papel era o código (`exigirCaixa`,
-- `exigirDono`, `OPERA`). Como `app_verandi` está exposto na Data API e a
-- chave publicável é pública, um profissional, com o próprio login e sem
-- passar pelas telas, podia dar baixa em cobrança, emitir recibo ou mudar o
-- preço de um plano.
--
-- Agora o banco diz o mesmo que as telas:
--
-- - `plano`: escreve quem responde pelo negócio (`dono`, `suporte`), como em
--   `src/server/planos/acoes.ts`;
-- - `contrato`, `pausa`, `cobranca`, `pagamento`, `recibo`: escreve a operação
--   (`dono`, `recepcao`, `suporte`), o `OPERA` de `src/server/conta.ts`.
--
-- A leitura não muda: qualquer membro segue lendo, porque a agenda e a ficha
-- do profissional leem contrato e cobrança.
--
-- Conferido no código em 19/out antes de fechar: toda gravação nessas tabelas
-- pela sessão passa por uma das conferências acima. A única exceção, a aula
-- avulsa criando o plano "Aula avulsa" pela recepção, passou a gravar pelo
-- servidor, depois de conferir conta e papel. API v1 e webhooks usam a chave
-- de serviço e não passam por aqui. Nenhuma função do banco grava nessas
-- tabelas.
--
-- Uma política por ação, como manda a `0080_vr`.

set search_path = app_verandi, extensions;

do $$
declare
  t record;
  papeis text;
begin
  for t in
    select * from (values
      ('plano',     'array[''dono'',''suporte'']::papel[]'),
      ('contrato',  'array[''dono'',''recepcao'',''suporte'']::papel[]'),
      ('pausa',     'array[''dono'',''recepcao'',''suporte'']::papel[]'),
      ('cobranca',  'array[''dono'',''recepcao'',''suporte'']::papel[]'),
      ('pagamento', 'array[''dono'',''recepcao'',''suporte'']::papel[]'),
      ('recibo',    'array[''dono'',''recepcao'',''suporte'']::papel[]')
    ) as v(tabela, papeis)
  loop
    papeis := t.papeis;
    execute format('drop policy if exists %I on app_verandi.%I', t.tabela || '_conta', t.tabela);
    execute format('drop policy if exists %I on app_verandi.%I', t.tabela || '_le', t.tabela);
    execute format('drop policy if exists %I on app_verandi.%I', t.tabela || '_insere', t.tabela);
    execute format('drop policy if exists %I on app_verandi.%I', t.tabela || '_atualiza', t.tabela);
    execute format('drop policy if exists %I on app_verandi.%I', t.tabela || '_apaga', t.tabela);

    execute format(
      'create policy %I on app_verandi.%I for select to authenticated
         using (conta_id in (select app_verandi.contas_do_usuario()))',
      t.tabela || '_le', t.tabela);
    execute format(
      'create policy %I on app_verandi.%I for insert to authenticated
         with check (app_verandi.tem_papel(conta_id, %s))',
      t.tabela || '_insere', t.tabela, papeis);
    execute format(
      'create policy %I on app_verandi.%I for update to authenticated
         using (app_verandi.tem_papel(conta_id, %s))
         with check (app_verandi.tem_papel(conta_id, %s))',
      t.tabela || '_atualiza', t.tabela, papeis, papeis);
    execute format(
      'create policy %I on app_verandi.%I for delete to authenticated
         using (app_verandi.tem_papel(conta_id, %s))',
      t.tabela || '_apaga', t.tabela, papeis);
  end loop;
end
$$;
