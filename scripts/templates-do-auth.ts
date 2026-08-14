/**
 * Envia para o Supabase os templates dos e-mails que o **Auth** manda.
 *
 *   set -a && . ../.secrets/4yu.env && set +a
 *   npx tsx scripts/templates-do-auth.ts [--dry]
 *
 * Por que um script e não a tela: o padrão do Supabase é em inglês
 * ("Reset your password"), e num produto brasileiro isso não passa. Colar HTML
 * à mão no painel a cada mudança garante que o e-mail do Auth e o do convite
 * vão divergir — aqui os dois saem da mesma casca, em `core/email/leiaute.ts`.
 *
 * O `{{ .ConfirmationURL }}` vai literal: quem troca pelo link real é o
 * Supabase, no envio.
 */
import { montaRecuperacao, montaTrocaDeEmail } from '../src/core/email/senha'

const REF = process.env.VERANDI_SUPABASE_REF ?? 'xxxynoshwirupkdzwxbj'
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN
const SECO = process.argv.includes('--dry')

if (!TOKEN) {
  console.error('falta SUPABASE_ACCESS_TOKEN — carregue o .secrets/4yu.env')
  process.exit(1)
}

const recuperacao = montaRecuperacao()
const troca = montaTrocaDeEmail()

const corpo = {
  mailer_subjects_recovery: recuperacao.assunto,
  mailer_templates_recovery_content: recuperacao.html,
  mailer_subjects_email_change: troca.assunto,
  mailer_templates_email_change_content: troca.html,
}

for (const [k, v] of Object.entries(corpo)) {
  console.log(`${k.padEnd(38)} ${k.includes('content') ? `${(v.length / 1024).toFixed(1)} KB` : v}`)
}

if (SECO) process.exit(0)

async function manda() {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/config/auth`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${TOKEN}`,
      'content-type': 'application/json',
      // sem isto o Cloudflare da api.supabase.com devolve 403 "error code: 1010"
      'user-agent': 'curl/8.5.0',
    },
    body: JSON.stringify(corpo),
  })
  console.log(r.ok ? '\ngravado' : `\nfalhou: ${r.status} ${(await r.text()).slice(0, 300)}`)
}

manda()
