set search_path = app_verandi, extensions;

/*
 * Nº da ficha único por conta, no banco.
 *
 * O app já recusa número repetido (`recusarNumeroEmUso`), mas duas abas
 * salvando ao mesmo tempo, ou a API, passavam pela conferência juntas. A regra
 * é a mesma do app: "072" e "72" são o mesmo número; o que não é só dígito
 * compara como texto.
 */
create unique index if not exists pessoa_numero_da_ficha_unico
  on pessoa (
    conta_id,
    (case when identificador_externo ~ '^\d+$'
          then ltrim(identificador_externo, '0')
          else identificador_externo end)
  )
  where identificador_externo is not null;
