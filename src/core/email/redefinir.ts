import { COR, botao, casca, destaque, escapa } from './leiaute'

/**
 * O e-mail de "esqueci a senha", montado por nós.
 *
 * Não é o do Supabase Auth de propósito. O rastreio de clique do Brevo reescreve
 * todo link, e o Brevo não permite desligar; o token do Supabase é consumido no
 * GET, então o rastreador abre o link antes da pessoa e ela recebe
 * `otp_expired`. O nosso token só é consumido quando a senha é enviada, no POST,
 * então um robô que abre a página não quebra nada.
 *
 * Quem recebe está travado do lado de fora e com pressa. Por isso o botão vem
 * antes de qualquer explicação, e o texto é curto.
 */

export type DadosDaRedefinicao = {
  link: string
  minutosAteExpirar: number
}

export function montaRedefinicao(d: DadosDaRedefinicao): {
  assunto: string
  html: string
  texto: string
} {
  const assunto = 'Sua senha da Verandi'

  const texto = [
    'Oi!',
    '',
    'Você pediu para criar uma senha nova. É só abrir este endereço:',
    d.link,
    '',
    `O link vale por ${d.minutosAteExpirar} minutos e só funciona uma vez.`,
    '',
    'Se não foi você quem pediu, pode ignorar este e-mail. Sua senha continua',
    'a mesma enquanto ninguém abrir o link.',
    '',
    'Um abraço,',
    'Equipe Verandi',
  ].join('\n')

  const corpo = `
    <p style="margin:0 0 18px;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:${COR.texto}">
      Oi! Você pediu para criar uma senha nova.
    </p>
    <p style="margin:0 0 26px;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:${COR.apoio}">
      É só clicar no botão e escolher a sua. Leva menos de um minuto.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:0 0 26px">
      ${botao('Criar minha senha', d.link)}
    </td></tr></table>

    <p style="margin:0 0 26px;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:12.5px;line-height:1.6;color:${COR.fraco}">
      Se o botão não abrir, copie este endereço:<br>
      <span style="word-break:break-all;color:${COR.verde}">${escapa(d.link)}</span>
    </p>

    ${destaque(
      'Não foi você?',
      `Pode ignorar este e-mail. Sua senha continua a mesma enquanto ninguém abrir o link, e ele perde a validade em ${d.minutosAteExpirar} minutos.`,
    )}`

  return {
    assunto,
    html: casca({
      preheader: 'É só clicar no botão e escolher uma senha nova.',
      eyebrow: 'Sua conta',
      titulo: 'Vamos criar sua senha',
      corpo,
    }),
    texto,
  }
}
