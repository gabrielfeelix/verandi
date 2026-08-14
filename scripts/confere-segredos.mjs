/**
 * Procura credencial de produção dentro do repositório.
 *
 *   npm run segredos
 *
 * Existe porque o repositório é **público** e porque a `BREVO_API_KEY` já
 * morou aqui uma vez, num `.env` gitignorado. Não vazou, mas o que separava a
 * chave do mundo era uma linha do `.gitignore`: um `git add -f` distraído, ou
 * alguém reescrevendo o arquivo, e acabou. Segredo de produção mora em
 * `4yu-apps/.secrets/`, fora de qualquer git.
 *
 * Olha arquivo rastreado e não rastreado, porque o perigo é justamente o que
 * ainda não foi commitado.
 *
 * Chave do Supabase **local** não conta: `supabase start` gera as mesmas para
 * todo mundo, estão na documentação deles, e tratá-las como segredo só ensina
 * a ignorar o aviso.
 */
import { execSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'

const PADROES = [
  [/xkeysib-[A-Za-z0-9]{20,}/, 'chave de API do Brevo'],
  [/xsmtpsib-[A-Za-z0-9]{20,}/, 'chave SMTP do Brevo'],
  [/sb_secret_[A-Za-z0-9_-]{10,}/, 'chave secreta do Supabase'],
  [/https:\/\/[a-z0-9]{20}\.supabase\.co/, 'projeto Supabase hospedado'],
  [/ghp_[A-Za-z0-9]{20,}/, 'token do GitHub'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'chave privada'],
]

// o `.env.local` guarda só o Supabase de 127.0.0.1; este próprio arquivo lista
// os padrões e acusaria a si mesmo
const IGNORA = [/^\.env\.local$/, /^scripts\/confere-segredos\.mjs$/]

function arquivos() {
  const saida = execSync(
    'git ls-files --cached --others --exclude-standard',
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  )
  return saida.split('\n').filter(Boolean)
}

const achados = []
for (const caminho of arquivos()) {
  if (IGNORA.some((r) => r.test(caminho))) continue
  let tamanho
  try {
    tamanho = statSync(caminho).size
  } catch {
    continue
  }
  if (tamanho > 2 * 1024 * 1024) continue // binário e artefato grande

  let texto
  try {
    texto = readFileSync(caminho, 'utf8')
  } catch {
    continue
  }
  for (const [padrao, oque] of PADROES) {
    const m = texto.match(padrao)
    if (m) {
      const linha = texto.slice(0, m.index).split('\n').length
      achados.push({ caminho, linha, oque })
    }
  }
}

if (achados.length === 0) {
  console.log('nenhuma credencial de produção no repositório')
  process.exit(0)
}

console.error('CREDENCIAL DE PRODUÇÃO DENTRO DO REPOSITÓRIO:\n')
for (const a of achados) console.error(`  ${a.caminho}:${a.linha}  ${a.oque}`)
console.error('\nO repositório é público. Mova para 4yu-apps/.secrets/4yu.env e,')
console.error('se já tiver sido commitada, REVOGUE a chave antes de qualquer outra coisa.')
process.exit(1)
