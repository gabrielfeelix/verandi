#!/usr/bin/env node
/**
 * A cópia de segurança do schema `app_verandi`.
 *
 * O banco de produção é dividido com o AutoFluxos e está no plano gratuito, que
 * não tem PITR nem backup automático. Enquanto não havia cliente pagante isso
 * era uma ressalva aceitável; vender encerra a ressalva.
 *
 * Três decisões que o script carrega, e que valem mais que o código:
 *
 * 1. **Só o nosso schema.** `--schema app_verandi` deixa `public` de fora, que é
 *    do outro produto. Restaurar um dump que carrega os dois seria pisar no
 *    AutoFluxos para consertar a Verandi.
 * 2. **Fora do Supabase.** Backup guardado no mesmo lugar que o banco protege
 *    contra `delete` errado e não protege contra perder a conta. O destino é
 *    argumento, e o padrão é uma pasta local **fora do repositório**, porque o
 *    repositório é público e o dump é dado pessoal de gente de verdade.
 * 3. **Prazo curto.** Dump é cópia integral de dado pessoal, inclusive de saúde.
 *    Guardar para sempre é criar o próximo problema de LGPD, então o script
 *    apaga o que passou da retenção. Sete dias cobrem "alguém apagou ontem e só
 *    percebeu na segunda".
 *
 * Uso:
 *   node scripts/backup.mjs [--destino ../backups-verandi] [--dias 7]
 *
 * Precisa de `AUTOFLUXOS_SUPABASE_DB_PASSWORD` e `AUTOFLUXOS_SUPABASE_PROJECT_REF`
 * no ambiente, que vêm de `.secrets/4yu.env`.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const args = process.argv.slice(2)
function opcao(nome, padrao) {
  const i = args.indexOf(`--${nome}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : padrao
}

const REF = process.env.AUTOFLUXOS_SUPABASE_PROJECT_REF
const SENHA = process.env.AUTOFLUXOS_SUPABASE_DB_PASSWORD
const DESTINO = resolve(opcao('destino', '../backups-verandi'))
const DIAS = Number(opcao('dias', '7'))

if (!REF || !SENHA) {
  console.error(
    'faltou AUTOFLUXOS_SUPABASE_PROJECT_REF ou AUTOFLUXOS_SUPABASE_DB_PASSWORD.\n' +
    'carregue com: set -a && . ../.secrets/4yu.env && set +a',
  )
  process.exit(1)
}

/*
 * O pooler na porta 5432 em modo sessão, e não o 6543: o modo transação não
 * aguenta o que o `pg_dump` faz, e a falha aparece no meio do dump como um erro
 * de protocolo que não fala de pooler nenhum.
 */
const URL_DO_BANCO =
  `postgresql://postgres.${REF}:${encodeURIComponent(SENHA)}@aws-0-sa-east-1.pooler.supabase.com:5432/postgres`

const agora = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const arquivo = join(DESTINO, `verandi-${agora}.sql.gz`)

mkdirSync(DESTINO, { recursive: true })

console.log(`destino: ${DESTINO}`)
console.log('rodando pg_dump do schema app_verandi...')

const CLI = 'npx --yes supabase@2.114.0 db dump --db-url "$URL" --schema app_verandi'

/*
 * Estrutura **e** dado, nesta ordem, num arquivo só.
 *
 * Só o dado não bastaria: restaurar num projeto novo precisa das tabelas antes
 * das linhas. E o dado precisa vir com `session_replication_role = replica`
 * porque `participacao.reposicao_de_id` aponta para `participacao`, uma chave
 * circular: sem desligar a checagem, a restauração falha na primeira reposição
 * cuja falta ainda não foi inserida. O `pg_dump` avisa disso e o aviso passa
 * despercebido justamente até o dia em que alguém precisa restaurar.
 */
/*
 * O que o dump não carrega, e a restauração precisa.
 *
 * `pg_dump --schema app_verandi` traz só o nosso schema, e as extensões moram em
 * `extensions`, fora dele. Isso não é detalhe: `pessoa.nome_busca` é coluna
 * gerada que chama `unaccent`, então **num banco sem a extensão toda inserção de
 * pessoa falha**, uma por uma, enquanto série, sessão e participação entram
 * normalmente. O resultado é uma restauração que parece ter dado certo e volta
 * sem nenhuma pessoa cadastrada, com o histórico apontando para gente que não
 * existe mais.
 *
 * Foi exatamente o que a primeira restauração de mentira encontrou, e é a razão
 * de ela existir.
 */
const PREAMBULO = [
  'create schema if not exists extensions;',
  'create extension if not exists pgcrypto with schema extensions;',
  'create extension if not exists unaccent with schema extensions;',
].join(' ')

const ROTEIRO = [
  `echo "${PREAMBULO}"`,
  CLI,
  'echo "set session_replication_role = replica;"',
  `${CLI} --data-only`,
  'echo "set session_replication_role = origin;"',
].join(' && ')

try {
  /*
   * `sh -c` para o `gzip` no meio do caminho: o dump inteiro em memória seria
   * desperdício, e escrever `.sql` cru deixa dado pessoal em texto aberto no
   * disco por mais tempo do que o necessário.
   */
  execFileSync('sh', ['-c', `{ ${ROTEIRO} ; } | gzip > "$SAIDA"`], {
    stdio: ['ignore', 'inherit', 'inherit'],
    env: { ...process.env, URL: URL_DO_BANCO, SAIDA: arquivo },
  })
} catch (e) {
  console.error('o dump falhou, e nada foi apagado:', e.message)
  process.exit(1)
}

const tamanho = statSync(arquivo).size
/*
 * Um dump de 20 bytes é um arquivo gzip vazio, e o `pg_dump` sai com código 0
 * nesse caso. Sem esta conferência, o rodízio abaixo apagaria os backups bons
 * para dar lugar a uma fila de arquivos vazios, e ninguém descobriria até
 * precisar restaurar.
 */
if (tamanho < 1024) {
  console.error(`o dump saiu com ${tamanho} bytes, o que não é um backup. Nada foi apagado.`)
  rmSync(arquivo)
  process.exit(1)
}

console.log(`ok  ${arquivo}  (${(tamanho / 1024).toFixed(0)} KB)`)

// ---------------------------------------------------------------------------
// Retenção
// ---------------------------------------------------------------------------

const limite = Date.now() - DIAS * 864e5
let apagados = 0
for (const nome of readdirSync(DESTINO)) {
  if (!nome.startsWith('verandi-') || !nome.endsWith('.sql.gz')) continue
  const caminho = join(DESTINO, nome)
  if (caminho === arquivo) continue
  if (statSync(caminho).mtimeMs < limite) {
    rmSync(caminho)
    apagados++
  }
}

const restam = readdirSync(DESTINO).filter((n) => n.startsWith('verandi-')).length
console.log(`retenção de ${DIAS} dias: ${apagados} apagados, ${restam} guardados`)

if (!existsSync(join(DESTINO, '.gitignore'))) {
  console.log(
    '\naviso: este destino guarda dado pessoal, inclusive de saúde.\n' +
    'ele precisa ficar fora de qualquer repositório e fora de pasta sincronizada pública.',
  )
}
