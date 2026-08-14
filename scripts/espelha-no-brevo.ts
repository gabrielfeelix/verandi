/**
 * Copia os e-mails para a tela de Modelos do Brevo, para dar para olhar lá.
 *
 *   set -a && . ../.secrets/4yu.env && set +a
 *   npx tsx scripts/espelha-no-brevo.ts
 *
 * **A fonte continua sendo o código.** Nada em produção manda usando estes
 * modelos: o convite vai por `htmlContent` a cada envio, e os do Auth vivem na
 * configuração do Supabase. O que existe aqui é uma cópia para conferir o
 * visual sem abrir o projeto, e é por isso que cada um nasce **desativado** e
 * com o aviso no nome. Modelo ativo no Brevo é convite a alguém editar lá e
 * descobrir semanas depois que a edição nunca saiu.
 *
 * Rode de novo depois de mexer em `src/core/email/`: o script atualiza o modelo
 * que já existe em vez de criar outro, então a cópia não se multiplica.
 */
import { montaConvite } from '../src/core/email/convite'
import { montaRedefinicao } from '../src/core/email/redefinir'
import { montaRecuperacao, montaTrocaDeEmail } from '../src/core/email/senha'

const CHAVE = process.env.BREVO_API_KEY
if (!CHAVE) {
  console.error('falta BREVO_API_KEY')
  process.exit(1)
}

const REMETENTE = { name: 'Verandi', email: 'nao-responda@verandi.mail.4yu.com.br' }
const AVISO = '[cópia, editar no código]'

const convite = montaConvite({
  nomeDaConta: 'Estúdio Lótus',
  papel: 'recepcao',
  link: 'https://verandi.4yu.com.br/convite/exemplo',
  quemConvidou: 'joana@estudiolotus.com.br',
  diasAteExpirar: 7,
})
const senhaNova = montaRedefinicao({
  link: 'https://verandi.4yu.com.br/convite/exemplo',
  minutosAteExpirar: 30,
})
const recuperacao = montaRecuperacao()
const troca = montaTrocaDeEmail()

/**
 * `{{ .ConfirmationURL }}` é sintaxe do Supabase, e o Brevo tenta interpretar
 * `{{ }}` com a linguagem dele: o modelo é recusado com erro de parser numa
 * linha que não diz nada. Na cópia o marcador vira um endereço de exemplo, o
 * que também deixa o preview mais parecido com o e-mail de verdade.
 */
const exemplo = (html: string) =>
  html.replace(/\{\{\s*\.ConfirmationURL\s*\}\}/g, 'https://verandi.4yu.com.br/exemplo')

const MODELOS = [
  { nome: `Convite ${AVISO}`, assunto: convite.assunto, html: convite.html },
  { nome: `Senha nova ${AVISO}`, assunto: senhaNova.assunto, html: senhaNova.html },
  { nome: `Senha pelo Auth ${AVISO}`, assunto: recuperacao.assunto, html: exemplo(recuperacao.html) },
  { nome: `Troca de e-mail ${AVISO}`, assunto: troca.assunto, html: exemplo(troca.html) },
]

async function api(caminho: string, metodo: string, corpo?: unknown) {
  const r = await fetch(`https://api.brevo.com/v3${caminho}`, {
    method: metodo,
    headers: { 'api-key': CHAVE!, 'content-type': 'application/json', accept: 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  })
  const texto = await r.text()
  if (!r.ok) throw new Error(`${r.status} ${texto.slice(0, 200)}`)
  return texto ? JSON.parse(texto) : {}
}

async function espelha() {
  const existentes: { id: number; name: string }[] =
    (await api('/smtp/templates?limit=100', 'GET')).templates ?? []

  for (const m of MODELOS) {
    const ja = existentes.find((t) => t.name === m.nome)
    const corpo = {
      templateName: m.nome,
      subject: m.assunto,
      htmlContent: m.html,
      sender: REMETENTE,
      isActive: false,
    }
    if (ja) {
      await api(`/smtp/templates/${ja.id}`, 'PUT', corpo)
      console.log(`atualizado  ${ja.id}  ${m.nome}`)
    } else {
      const novo = await api('/smtp/templates', 'POST', corpo)
      console.log(`criado      ${novo.id}  ${m.nome}`)
    }
  }
  console.log('\nOs quatro nascem desativados de propósito: são cópia para olhar,')
  console.log('e nada em produção manda usando eles. Edite em src/core/email/.')
}

espelha()
