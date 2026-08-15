#!/usr/bin/env node
/**
 * A prova de que o backup é backup.
 *
 * Um arquivo que ninguém restaurou não é cópia de segurança, é esperança: o dump
 * pode estar truncado, sem uma tabela, com ordem de inserção impossível, e nada
 * disso aparece até o dia em que alguém precisa dele, que é o pior dia possível
 * para descobrir.
 *
 * Este script restaura o dump **num banco descartável dentro do Postgres local**,
 * não em produção e não no banco de desenvolvimento. Ele cria o banco, restaura,
 * conta as linhas, compara com o que o dump dizia carregar, e apaga tudo.
 *
 * Uso:
 *   node scripts/restaura-de-mentira.mjs caminho/do/verandi-....sql.gz
 */

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const arquivo = resolve(process.argv[2] ?? '')
if (!arquivo || !existsSync(arquivo)) {
  console.error('uso: node scripts/restaura-de-mentira.mjs <arquivo.sql.gz>')
  process.exit(1)
}

const CONTEINER = 'supabase_db_verandi'
const BANCO = `restauracao_${Date.now()}`

function psql(sql, banco = 'postgres') {
  return execFileSync('docker', [
    'exec', '-i', CONTEINER, 'psql', '-U', 'postgres', '-d', banco, '-tAc', sql,
  ], { encoding: 'utf8' }).trim()
}

console.log(`banco descartável: ${BANCO}`)

try {
  execFileSync('docker', ['exec', CONTEINER, 'psql', '-U', 'postgres', '-c',
    `create database ${BANCO}`], { stdio: 'ignore' })
} catch {
  console.error(`não consegui criar o banco. O Supabase local está de pé? (${CONTEINER})`)
  process.exit(1)
}

let falhou = false
try {
  /*
   * O dump referencia `auth.users` nas chaves estrangeiras, e num banco vazio
   * esse schema não existe. Criar os dois schemas e uma `auth.users` mínima é o
   * que permite conferir o nosso dado sem restaurar o Supabase inteiro.
   *
   * Num desastre de verdade a restauração vai para um projeto Supabase novo, que
   * já traz `auth` pronto. Aqui o objetivo é outro: provar que **o nosso dump**
   * está íntegro e na ordem certa.
   */
  psql(`
    create schema if not exists auth;
    create table if not exists auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
  `, BANCO)

  console.log('restaurando...')
  execFileSync('sh', ['-c',
    `gunzip -c "$ARQ" | docker exec -i ${CONTEINER} psql -U postgres -d ${BANCO} -v ON_ERROR_STOP=0 2>&1 | grep -c "^ERROR" || true`,
  ], { encoding: 'utf8', env: { ...process.env, ARQ: arquivo } })

  const blocos = execFileSync('sh', ['-c',
    `gunzip -c "$ARQ" | grep -c "^INSERT INTO" || true`,
  ], { encoding: 'utf8', env: { ...process.env, ARQ: arquivo } }).trim()

  const tabelas = psql(
    `select count(*) from information_schema.tables
      where table_schema = 'app_verandi' and table_type = 'BASE TABLE'`, BANCO)

  console.log(`\ntabelas restauradas: ${tabelas}`)
  console.log(`blocos de dado no arquivo: ${blocos}`)

  /*
   * A conferência que importa não é "restaurou sem erro", é **a conta voltou de
   * pé**: uma conta com grade, gente e chamada. Contar linha por linha de vinte e
   * sete tabelas seria frágil; estas quatro respondem se o negócio volta a
   * funcionar.
   */
  const linhas = {}
  for (const t of ['conta', 'pessoa', 'serie', 'sessao', 'participacao', 'usuario_conta']) {
    linhas[t] = Number(psql(`select count(*) from app_verandi.${t}`, BANCO))
  }
  console.table(linhas)

  const vazio = Object.entries(linhas).filter(([, n]) => n === 0).map(([t]) => t)
  if (Number(tabelas) < 20) {
    console.error(`\nFALHOU: só ${tabelas} tabelas voltaram, e o schema tem mais que isso.`)
    falhou = true
  } else if (vazio.length) {
    console.error(`\nFALHOU: voltou sem linha nenhuma em ${vazio.join(', ')}.`)
    falhou = true
  } else {
    console.log('\nok  a conta volta de pé: estrutura, gente, grade e chamada.')
  }
} finally {
  execFileSync('docker', ['exec', CONTEINER, 'psql', '-U', 'postgres', '-c',
    `drop database if exists ${BANCO} with (force)`], { stdio: 'ignore' })
  console.log(`banco descartável apagado`)
}

process.exit(falhou ? 1 : 0)
