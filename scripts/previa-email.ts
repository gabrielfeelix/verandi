/**
 * Gera o HTML de um e-mail e, se pedirem, manda para um endereço de verdade.
 *
 *   npx tsx scripts/previa-email.ts                      # escreve .previa/convite.html
 *   npx tsx scripts/previa-email.ts eu@exemplo.com       # e manda, para ver no cliente
 *
 * Ler o HTML não substitui abrir num cliente de e-mail — é a mesma lição do
 * `VESTIR.md`, e vale ainda mais aqui: Gmail, Apple Mail e Outlook renderizam o
 * mesmo arquivo de três jeitos, e o Outlook usa o motor do Word.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { montaConvite } from '../src/core/email/convite'
import { nomeDeRemetente } from '../src/core/email/remetente'
import { montaRecuperacao, montaTrocaDeEmail } from '../src/core/email/senha'

const EXEMPLO = {
  nomeDaConta: 'Estúdio Lótus',
  papel: 'recepcao',
  link: 'https://verandi.4yu.com.br/convite/exemplo-de-token-abc123',
  quemConvidou: 'joana@estudiolotus.com.br',
  diasAteExpirar: 7,
}

const email = montaConvite(EXEMPLO)

mkdirSync('.previa', { recursive: true })
writeFileSync('.previa/convite.html', email.html)
writeFileSync('.previa/convite.txt', email.texto)

// os do Auth vão junto: eles saem da mesma casca, e é olhando lado a lado que
// se percebe quando um dos dois começou a divergir
const rec = montaRecuperacao()
writeFileSync('.previa/senha.html', rec.html)
const tro = montaTrocaDeEmail()
writeFileSync('.previa/troca-de-email.html', tro.html)
console.log(`também escritos: .previa/senha.html · .previa/troca-de-email.html`)

const kb = (email.html.length / 1024).toFixed(1)
console.log(`assunto:    ${email.assunto}`)
console.log(`remetente:  ${nomeDeRemetente(EXEMPLO.nomeDaConta)}`)
console.log(`tamanho:    ${kb} KB  (o Gmail corta acima de 100 KB)`)
console.log('escrito em: .previa/convite.html')

const destino = process.argv[2]
if (!destino) process.exit(0)

/*
 * Só do ambiente, nunca de arquivo do repositório.
 *
 * Havia um atalho aqui que lia `.env` da pasta do projeto. O repositório é
 * público, e chave de produção dentro dele depende de o `.gitignore` estar
 * certo para sempre: basta um `git add -f` distraído. O segredo mora em
 * `4yu-apps/.secrets/`, fora de qualquer git, e é carregado por quem roda.
 */
const chave = process.env.BREVO_API_KEY

if (!chave) {
  console.error('\nsem BREVO_API_KEY. Carregue os segredos antes:')
  console.error('  set -a && . ../.secrets/4yu.env && set +a')
  process.exit(1)
}

// envolvido numa função porque o `tsx` compila para CommonJS, que não aceita
// `await` no topo do módulo
async function manda() {
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': chave!, 'content-type': 'application/json' },
    body: JSON.stringify({
      sender: {
        name: nomeDeRemetente(EXEMPLO.nomeDaConta),
        email: 'nao-responda@verandi.mail.4yu.com.br',
      },
      to: [{ email: destino }],
      subject: `[prévia] ${email.assunto}`,
      htmlContent: email.html,
      textContent: email.texto,
    }),
  })
  console.log(r.ok ? `\nenviado para ${destino}` : `\nfalhou: ${r.status} ${await r.text()}`)
}

manda()
