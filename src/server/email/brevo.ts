import { nomeDeRemetente } from '@/core/email/remetente'

/**
 * Envio transacional pela API do Brevo.
 *
 * Só para o que é conceito da Verandi — hoje o convite. Senha e confirmação
 * saem pelo Supabase Auth, que fala com o mesmo Brevo por SMTP: são e-mails
 * que o Auth já sabe montar, e reimplementá-los seria refazer de graça o que
 * ele faz melhor, inclusive a validade do token.
 *
 * O domínio de envio é `verandi.mail.4yu.com.br`, não `4yu.com.br`: a caixa de
 * trabalho da 4YU mora no raiz, e reclamação de spam de app não pode degradar a
 * entrega dela. O contrato inteiro está no `CLAUDE.md` da pasta `4yu-apps`.
 */

const REMETENTE = 'nao-responda@verandi.mail.4yu.com.br'

export type Envio = {
  para: string
  /** Aparece antes do "via Verandi". Costuma ser `conta.nome`. */
  de: string | null | undefined
  assunto: string
  html: string
  texto: string
  /** Para quem a resposta vai. No convite, quem convidou. */
  responderPara?: { email: string; nome?: string }
  /**
   * Cópias, à vista de quem recebe.
   *
   * `cc` e não `bcc`: quem paga tem o direito de saber que o comprovante dele
   * também foi para o marido e para a contadora. Cópia oculta num documento
   * financeiro é o tipo de coisa que ninguém pediu e que fica difícil de
   * explicar depois.
   */
  copias?: string[]
}

/**
 * `true` se saiu, `false` se não deu.
 *
 * Não lança de propósito. Nenhum e-mail desta aplicação é o único caminho para
 * o que ele carrega — o convite continua acessível como link na tela. Derrubar
 * a criação do convite porque o Brevo piscou trocaria uma falha pequena e
 * contornável por uma grande: a dona veria erro e não teria nem o link.
 */
export async function envia(envio: Envio): Promise<boolean> {
  const chave = process.env.BREVO_API_KEY
  if (!chave) {
    // Local e CI não mandam e-mail, e isso não é erro: é o esperado. Avisar em
    // silêncio esconderia o caso em que a chave sumiu da produção.
    console.warn('[email] BREVO_API_KEY ausente, nada foi enviado para', envio.para)
    return false
  }

  try {
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': chave,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: nomeDeRemetente(envio.de), email: REMETENTE },
        to: [{ email: envio.para }],
        ...(envio.copias?.length ? { cc: envio.copias.map((email) => ({ email })) } : {}),
        ...(envio.responderPara ? { replyTo: envio.responderPara } : {}),
        subject: envio.assunto,
        htmlContent: envio.html,
        textContent: envio.texto,
      }),
    })

    if (!r.ok) {
      const corpo = await r.text()
      console.error(`[email] Brevo recusou (${r.status}) para ${envio.para}: ${corpo}`)
      return false
    }
    return true
  } catch (e) {
    console.error(`[email] falhou ao enviar para ${envio.para}:`, e)
    return false
  }
}
