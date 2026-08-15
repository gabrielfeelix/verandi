/**
 * Gera `src/server/banco.types.ts` a partir do banco local.
 *
 *   npx supabase start      # o banco precisa estar de pé
 *   npm run tipos
 *
 * Existe como script, e não como uma linha no `package.json`, por causa do
 * cabeçalho: sem ele o arquivo gerado parece escrito à mão, e a próxima pessoa
 * edita a coluna ali em vez de na migration. O aviso precisa estar dentro do
 * arquivo, não no histórico do git.
 *
 * Só `app_verandi`. O projeto de produção é dividido com o AutoFluxos, que mora
 * em `public`, e gerar o schema inteiro traria as doze tabelas dele para dentro
 * deste repositório, que é público. Ver `docs/BANCO-COMPARTILHADO.md`.
 */
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const DESTINO = 'src/server/banco.types.ts'

const CABECALHO = `/*
 * GERADO. Não edite à mão.
 *
 *   npm run tipos          (com o Supabase local de pé)
 *
 * Sai de \`supabase gen types typescript --local --schema app_verandi\`, e é a
 * forma do banco em TypeScript: toda tabela, toda coluna, toda chave
 * estrangeira. Enquanto isto não existia, \`db.from('pessoa').select(...)\`
 * devolvia \`GenericStringError\`, e cada consulta precisava dizer o que
 * esperava com \`.returns<T[]>()\`: um tipo escrito à mão, ao lado de um
 * \`select\` em texto, sem nada checando que os dois falavam da mesma coluna.
 * Errar o nome de uma coluna só aparecia em produção.
 *
 * **Migration nova pede tipo novo.** Aplique a migration no banco local
 * (\`npx supabase db reset\`) e rode \`npm run tipos\`. Se esquecer, o \`tsc\`
 * continua passando com a forma antiga, e é justamente esse silêncio que este
 * arquivo veio tirar.
 *
 * **Nada de escrever aqui.** Este arquivo é reescrito inteiro a cada geração, e
 * o que estiver no fim dele some sem aviso. Atalho e tipo derivado moram em
 * \`banco.ts\`, ao lado.
 */

`

let saida
try {
  saida = execFileSync(
    'npx',
    ['supabase', 'gen', 'types', 'typescript', '--local', '--schema', 'app_verandi'],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  )
} catch (e) {
  console.error('não deu para gerar. O Supabase local está de pé? `npx supabase start`')
  console.error(String(e.stderr ?? e.message).trim())
  process.exit(1)
}

// banco vazio gera um arquivo curto e válido, que apagaria os tipos sem erro
if (!saida.includes('app_verandi:') || saida.length < 2000) {
  console.error('o banco local respondeu sem as tabelas. Rode `npx supabase db reset`.')
  process.exit(1)
}

writeFileSync(DESTINO, CABECALHO + saida)
console.log(`${DESTINO} · ${saida.split('\n').length} linhas`)
