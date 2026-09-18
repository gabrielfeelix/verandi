/**
 * Apaga todo o movimento e o cadastro de uma conta, mantendo a conta em pé.
 *
 *   set -a && . ../.secrets/4yu.env && set +a
 *   node scripts/zera-conta.mjs mgm-pilates --dry
 *   node scripts/zera-conta.mjs mgm-pilates --confirmo
 *
 * Por que existe: uma conta criada para demonstração acumula dado de ensaio —
 * pessoas inventadas, contratos que ninguém assinou, recibos que gastaram
 * número. Antes da primeira venda de verdade isso precisa sair, e sair inteiro:
 * recibo emitido gasta número, e numeração com buraco é papel que não existe.
 *
 * O que ele NÃO apaga, de propósito: a própria conta, os usuários com acesso a
 * ela, as chaves de API, o horário de funcionamento, o vocabulário, o
 * onboarding e o aceite de termos. Isso é configuração da conta, não dado do
 * estúdio: apagar derruba o login e as telas abrem quebradas em vez de vazias.
 *
 * Não há backup no plano gratuito, e o banco é dividido com o AutoFluxos. Por
 * isso tudo roda numa transação só, filtrado por `conta_id`, e nunca encosta em
 * `public`. Sem `--confirmo` o script apenas conta.
 */
const REF = process.env.VERANDI_SUPABASE_REF ?? 'xxxynoshwirupkdzwxbj'
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN

const SLUG = process.argv[2]
const SECO = !process.argv.includes('--confirmo')

if (!TOKEN) {
  console.error('falta SUPABASE_ACCESS_TOKEN — carregue o .secrets/4yu.env')
  process.exit(1)
}
if (!SLUG || !/^[a-z0-9-]+$/.test(SLUG)) {
  console.error('uso: node scripts/zera-conta.mjs <slug-da-conta> [--confirmo]')
  process.exit(1)
}

/**
 * A ordem é de filho para pai: cada linha só sai depois de quem aponta para
 * ela. Mudar a ordem troca um `delete` limpo por um erro de chave estrangeira
 * no meio da transação.
 */
const TABELAS = [
  'envio_de_recibo',
  'recibo',
  'contador_recibo',
  'pagamento',
  'cobranca',
  'contrato',
  'avaliacao_foto',
  'posicao_avaliacao',
  'avaliacao',
  'participacao',
  'espera',
  'vaga',
  'pausa',
  'sessao',
  'excecao_calendario',
  'serie',
  'pessoa_tag',
  'pendencia_dispensada',
  'evento_saida',
  'pessoa',
  'profissional_servico',
  'profissional',
  'plano',
  'servico',
  'local',
]

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${TOKEN}`,
      'content-type': 'application/json',
      // Sem User-Agent explícito o Cloudflare da api.supabase.com devolve 403.
      'user-agent': 'curl/8.5.0',
    },
    body: JSON.stringify({ query }),
  })
  const corpo = await r.json()
  if (!r.ok || corpo?.message) throw new Error(corpo?.message ?? `HTTP ${r.status}`)
  return corpo
}

const conta = await sql(
  `select id, nome from app_verandi.conta where slug = '${SLUG}'`,
)
if (conta.length !== 1) {
  console.error(`conta '${SLUG}' não encontrada`)
  process.exit(1)
}
const { id, nome } = conta[0]
console.log(`conta: ${nome} (${id})\n`)

const contagem = await sql(
  TABELAS.map(
    (t) =>
      `select '${t}' as tabela, count(*)::int as n from app_verandi.${t} where conta_id = '${id}'`,
  ).join(' union all '),
)
let total = 0
for (const { tabela, n } of contagem) {
  if (n > 0) console.log(`  ${String(n).padStart(6)}  ${tabela}`)
  total += n
}
console.log(`\n  ${String(total).padStart(6)}  linhas no total`)

if (SECO) {
  console.log('\nensaio: nada foi apagado. Para valer: --confirmo')
  process.exit(0)
}

const apaga = [
  'begin;',
  ...TABELAS.map((t) => `delete from app_verandi.${t} where conta_id = '${id}';`),
  'commit;',
].join('\n')

await sql(apaga)
console.log('\napagado.')

const sobrou = await sql(
  TABELAS.map(
    (t) => `select count(*)::int as n from app_verandi.${t} where conta_id = '${id}'`,
  ).join(' union all '),
)
const resto = sobrou.reduce((s, { n }) => s + n, 0)
console.log(resto === 0 ? 'conferido: zero linhas restantes.' : `ATENÇÃO: sobraram ${resto} linhas.`)
