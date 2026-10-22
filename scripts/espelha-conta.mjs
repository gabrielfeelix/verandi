/**
 * Espelha uma conta em outra: a staging de um cliente.
 *
 *   set -a && . ../.secrets/4yu.env && set +a
 *   node scripts/espelha-conta.mjs mgm-pilates 4yu-teste            # ensaio
 *   node scripts/espelha-conta.mjs mgm-pilates 4yu-teste --confirmo
 *
 * Por que existe: a "4YU TESTE" é a staging da MGM. O Gabriel experimenta lá
 * (bot, formulário de agendamento, telas) com os mesmos alunos, turmas e
 * histórico, sem encostar na conta do Daniel. Rodar de novo atualiza a cópia.
 *
 * O que faz, numa transação só (falhou no meio, nada mudou):
 *
 * 1. apaga o movimento e o cadastro do **destino**, na ordem de
 *    `zera-conta.mjs`, mais funcionamento, vocabulário e contador de recibo;
 * 2. copia da **origem**, com ids novos e cada referência entre linhas
 *    trocada pelo id novo: serviços, profissionais, locais, planos, grade,
 *    aulas, alunos, matrículas, presença, contratos, cobranças, pagamentos,
 *    recibos, avaliações, feriados, funcionamento e vocabulário;
 * 3. **mascara o que alcança gente de verdade.** Telefone vira `4400000xxxx`
 *    (fixo começando em 0 não existe: nenhum WhatsApp nem ligação chega a um
 *    aluno da origem por um teste na staging), e-mail, CPF, RG, telefones
 *    fixos e foto ficam vazios. Profissional perde e-mail, telefone, foto e o
 *    login (`usuario_id`).
 *
 * Fica de fora, de propósito: a própria conta, logins, convites, chaves de
 * API, webhooks, fila de eventos de saída, envios de recibo, fotos de
 * avaliação (o arquivo no Storage é da origem: apagar na staging apagaria o
 * dela) e o que é preferência de tela.
 *
 * Só escreve em `app_verandi`, filtrado pelo `conta_id` do destino. Nunca
 * escreve na origem. O banco é dividido com o AutoFluxos e não tem backup no
 * plano gratuito: por isso uma transação, e ensaio por padrão.
 */
const REF = process.env.VERANDI_SUPABASE_REF ?? 'xxxynoshwirupkdzwxbj'
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN
const [ORIGEM, DESTINO] = process.argv.slice(2)
const SECO = !process.argv.includes('--confirmo')

if (!TOKEN) {
  console.error('falta SUPABASE_ACCESS_TOKEN: carregue o .secrets/4yu.env')
  process.exit(1)
}
const slug = /^[a-z0-9-]+$/
if (!ORIGEM || !DESTINO || !slug.test(ORIGEM) || !slug.test(DESTINO) || ORIGEM === DESTINO) {
  console.error('uso: node scripts/espelha-conta.mjs <slug-origem> <slug-destino> [--confirmo]')
  process.exit(1)
}

/** O que sai do destino, de filho para pai (a ordem do `zera-conta.mjs`). */
const APAGAR = [
  'envio_de_recibo', 'recibo', 'contador_recibo', 'pagamento', 'cobranca', 'contrato',
  'avaliacao_foto', 'posicao_avaliacao', 'avaliacao', 'participacao', 'espera', 'vaga',
  'pausa', 'sessao', 'excecao_calendario', 'serie', 'pessoa_tag', 'pendencia_dispensada',
  'evento_saida', 'pessoa', 'profissional_servico', 'profissional', 'plano', 'servico',
  'local', 'funcionamento', 'vocabulario',
]

/** O que entra, de pai para filho. */
const COPIAR = [
  'servico', 'profissional', 'local', 'profissional_servico', 'plano', 'serie', 'sessao',
  'pessoa', 'pessoa_tag', 'contrato', 'vaga', 'participacao', 'espera', 'licenca', 'pausa',
  'cobranca', 'pagamento', 'recibo', 'contador_recibo', 'avaliacao', 'posicao_avaliacao',
  'excecao_calendario', 'pendencia_dispensada', 'funcionamento', 'vocabulario',
]

/** Referência para a própria tabela: entra nula e é ligada depois. */
const AUTORREFERENCIA = { participacao: 'reposicao_de_id', recibo: 'substitui_id' }

const lista = (xs) => `array[${xs.map((x) => `'${x}'`).join(', ')}]`

const corpo = `
do $$
declare
  conta_origem uuid := (select id from app_verandi.conta where slug = '${ORIGEM}');
  conta_destino uuid := (select id from app_verandi.conta where slug = '${DESTINO}');
  t text;
  colunas text;
  valores text;
begin
  if conta_origem is null or conta_destino is null then raise exception 'conta não encontrada'; end if;

  foreach t in array ${lista(APAGAR)} loop
    execute format('delete from app_verandi.%I where conta_id = $1', t) using conta_destino;
  end loop;
  -- licenca não está no zera-conta: sai junto, antes do que ela aponta já ter saído
  delete from app_verandi.licenca where conta_id = conta_destino;

  create temp table mapa (velho uuid primary key, novo uuid not null) on commit drop;
  foreach t in array ${lista(COPIAR)} loop
    if exists (select 1 from information_schema.columns
               where table_schema = 'app_verandi' and table_name = t and column_name = 'id') then
      execute format('insert into mapa select id, gen_random_uuid() from app_verandi.%I where conta_id = $1', t)
        using conta_origem;
    end if;
  end loop;

  foreach t in array ${lista(COPIAR)} loop
    select string_agg(quote_ident(column_name), ', ' order by ordinal_position),
           string_agg(case
             when column_name = 'conta_id' then '$2'
             when column_name in (${Object.values(AUTORREFERENCIA).map((c) => `'${c}'`).join(', ')}) then 'null'
             when data_type = 'uuid' then format('coalesce((select novo from mapa where velho = %1$I), %1$I)', column_name)
             else quote_ident(column_name) end, ', ' order by ordinal_position)
      into colunas, valores
      from information_schema.columns
     where table_schema = 'app_verandi' and table_name = t
       and is_generated = 'NEVER' and coalesce(identity_generation, '') <> 'ALWAYS';
    execute format('insert into app_verandi.%I (%s) select %s from app_verandi.%I where conta_id = $1',
                   t, colunas, valores, t) using conta_origem, conta_destino;
  end loop;

  update app_verandi.participacao p set reposicao_de_id = m2.novo
    from app_verandi.participacao o
    join mapa m1 on m1.velho = o.id
    join mapa m2 on m2.velho = o.reposicao_de_id
   where p.id = m1.novo and o.conta_id = conta_origem;
  update app_verandi.recibo p set substitui_id = m2.novo
    from app_verandi.recibo o
    join mapa m1 on m1.velho = o.id
    join mapa m2 on m2.velho = o.substitui_id
   where p.id = m1.novo and o.conta_id = conta_origem;

  update app_verandi.pessoa p
     set telefone = case when p.telefone is null then null else '4400000' || lpad(n::text, 4, '0') end,
         email = null, cpf = null, rg = null, telefone_residencial = null, telefone_comercial = null,
         foto_path = null
    from (select id, row_number() over (order by criado_em, id) n from app_verandi.pessoa where conta_id = conta_destino) s
   where p.id = s.id;
  update app_verandi.profissional
     set email = null, telefone = null, foto_path = null, usuario_id = null
   where conta_id = conta_destino;
end $$;
`

const contar = `select t as tabela,
  (xpath('/row/n/text()', query_to_xml(format('select count(*) n from app_verandi.%I where conta_id = (select id from app_verandi.conta where slug = %L)', t, '${ORIGEM}'), false, true, '')))[1]::text::int as origem,
  (xpath('/row/n/text()', query_to_xml(format('select count(*) n from app_verandi.%I where conta_id = (select id from app_verandi.conta where slug = %L)', t, '${DESTINO}'), false, true, '')))[1]::text::int as destino
  from unnest(${lista(COPIAR)}) t`

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json', 'user-agent': 'curl/8.5.0' },
    body: JSON.stringify({ query }),
  })
  const resposta = await r.json()
  if (!r.ok || resposta?.message) throw new Error(resposta?.message ?? `HTTP ${r.status}`)
  return resposta
}

const resultado = await sql(`begin; ${corpo} ${contar}; ${SECO ? 'rollback' : 'commit'};`)
console.log(`${ORIGEM} → ${DESTINO}${SECO ? ' (ensaio, desfeito)' : ''}\n`)
for (const { tabela, origem, destino } of resultado) {
  console.log(`  ${tabela.padEnd(22)} ${String(origem).padStart(6)} ${String(destino).padStart(6)}${origem === destino ? '' : '  ≠'}`)
}
if (SECO) console.log('\nensaio: nada mudou. Para valer: --confirmo')
