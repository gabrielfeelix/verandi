/**
 * Aplica em produção as migrations que ainda não rodaram.
 *
 *   set -a && . ../.secrets/4yu.env && set +a
 *   node scripts/aplica-em-producao.mjs [--dry]
 *
 * Por que existe, em vez de `supabase db push`: enquanto não há faturamento, a
 * Verandi divide o projeto Supabase com o AutoFluxos. O `db push` compara a
 * pasta local com a `supabase_migrations.schema_migrations` do projeto, que é
 * uma só para os dois — e passaria a reclamar, de cada lado, das versões do
 * outro. Aqui o controle mora em `app_verandi.migrations_aplicadas`: some junto
 * no dia do `drop schema`, e não encosta no que é do AutoFluxos.
 *
 * Para desfazer tudo: `supabase/desfazer-verandi.sql`.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const REF = process.env.VERANDI_SUPABASE_REF ?? 'xxxynoshwirupkdzwxbj'
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN
const SECO = process.argv.includes('--dry')
const PASTA = 'supabase/migrations'

if (!TOKEN) {
  console.error('falta SUPABASE_ACCESS_TOKEN — carregue o .secrets/4yu.env')
  process.exit(1)
}

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${TOKEN}`,
      'content-type': 'application/json',
      // Sem User-Agent explícito o Cloudflare da api.supabase.com devolve 403
      // "error code: 1010" — bloqueio pela assinatura do cliente, não pelo
      // token. O erro não menciona Supabase e manda procurar no lugar errado.
      'user-agent': 'curl/8.5.0',
    },
    body: JSON.stringify({ query }),
  })
  const corpo = await r.json()
  if (!r.ok || (corpo && corpo.message)) {
    throw new Error(corpo?.message ?? `HTTP ${r.status}`)
  }
  return corpo
}

/**
 * Versões já aplicadas.
 *
 * Banco virgem ainda não tem a tabela, e isso é normal. **Qualquer outra falha
 * não é.** Antes daqui o `catch` engolia tudo e devolvia conjunto vazio: token
 * errado, permissão, rede ou API fora do ar viravam "nenhuma migration foi
 * aplicada", e o passo seguinte reaplicaria as quinze em cima de um banco
 * cheio. A primeira falharia, mas só depois de a anterior ter passado.
 *
 * Então a pergunta é feita em duas partes. Primeiro **se a tabela existe**, com
 * uma consulta que responde sem erro nos dois casos: se essa falhar, é falha de
 * verdade e o programa para. Só o "não existe" segue como banco virgem.
 */
async function jaAplicadas() {
  const existe = await sql(
    "select to_regclass('app_verandi.migrations_aplicadas') is not null as tem",
  )
  if (!existe?.[0]?.tem) {
    console.log('sem tabela de controle: tratando como banco virgem\n')
    return new Set()
  }
  const linhas = await sql(
    'select versao from app_verandi.migrations_aplicadas order by versao',
  )
  return new Set(linhas.map((l) => l.versao))
}

const arquivos = readdirSync(PASTA).filter((f) => f.endsWith('.sql')).sort()

/*
 * Falha aqui não vira "banco virgem", e também não vira stack trace: quem
 * precisa da mensagem está aplicando em produção, e o que importa é saber que
 * **nada foi escrito**.
 */
let feitas
try {
  feitas = await jaAplicadas()
} catch (e) {
  console.error(`não deu para ler o controle de migrations: ${e.message}`)
  console.error('Nada foi aplicado. Confira o token, a rede e o ref do projeto.')
  process.exit(1)
}

const pendentes = arquivos.filter((f) => !feitas.has(f.split('_')[0]))

if (pendentes.length === 0) {
  console.log(`nada a fazer — as ${arquivos.length} já estão aplicadas`)
  process.exit(0)
}

console.log(`${feitas.size} aplicadas · ${pendentes.length} pendentes\n`)
if (SECO) {
  for (const f of pendentes) console.log(`  rodaria ${f}`)
  process.exit(0)
}

for (const arquivo of pendentes) {
  const [versao, ...resto] = arquivo.replace(/\.sql$/, '').split('_')
  try {
    await sql(readFileSync(join(PASTA, arquivo), 'utf8'))
  } catch (e) {
    console.error(`\nFALHOU em ${arquivo}:\n${e.message}`)
    console.error('\nAs anteriores continuam aplicadas. Corrija e rode de novo.')
    process.exit(1)
  }
  // A tabela de controle só pode existir depois que a 0030 cria o schema.
  //
  // Ela não é dado de conta nenhuma, e por isso não ganha política: ganha RLS
  // ligada e sem política, mais a revogação explícita. O `alter default
  // privileges` da 0030 concede a `authenticated` tudo que nasce no schema — e
  // aqui isso daria a qualquer usuário logado, de qualquer cliente, o poder de
  // APAGAR linha do controle. O aplicador então rodaria migration de novo.
  // `service_role` e `postgres` passam por cima de RLS, que é o que este
  // script usa.
  await sql(`
    create table if not exists app_verandi.migrations_aplicadas (
      versao      text primary key,
      nome        text not null,
      aplicada_em timestamptz not null default now()
    )`)
  await sql('alter table app_verandi.migrations_aplicadas enable row level security')
  await sql(`
    revoke all on app_verandi.migrations_aplicadas from anon, authenticated`)
  await sql(
    `insert into app_verandi.migrations_aplicadas (versao, nome)
     values ('${versao}', '${resto.join('_')}') on conflict (versao) do nothing`,
  )
  console.log(`ok  ${arquivo}`)
}

console.log('\nFalta o passo que não tem API: no painel do projeto,')
console.log('Integrations -> Data API -> Settings -> Exposed schemas -> app_verandi.')
