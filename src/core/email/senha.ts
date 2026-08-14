import { COR, botao, casca, destaque, escapa } from './leiaute'

/**
 * Os e-mails que o **Supabase Auth** manda: redefinir senha e trocar e-mail.
 *
 * Diferem do convite em três coisas que mudam o texto inteiro:
 *
 * 1. **Quem recebe já é usuário.** Está olhando a tela da Verandi neste
 *    segundo, porque acabou de clicar em "esqueci a senha". Não precisa de
 *    boas-vindas nem de explicação do que é o produto.
 * 2. **O nome do remetente é fixo.** O Auth tem um só por projeto, e não sabe
 *    de qual conta a pessoa é. Sai como "Verandi", e está certo assim.
 * 3. **O link é do Supabase, não nosso.** `{{ .ConfirmationURL }}` é
 *    substituído por ele no envio. O template vai para lá com o marcador
 *    literal dentro — por isso estas funções não recebem link nenhum.
 *
 * O tom é o mesmo do convite: frases curtas, "Oi!", nada de "prezado usuário".
 * O que muda é a urgência — aqui a pessoa está travada do lado de fora, então
 * o botão vem antes de qualquer outra coisa.
 */

/** O marcador que o Supabase troca pelo link de verdade. */
const URL_DO_SUPABASE = '{{ .ConfirmationURL }}'

export function montaRecuperacao(): { assunto: string; html: string } {
  const corpo = `
    <p style="margin:0 0 18px;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:${COR.texto}">
      Oi! Recebemos um pedido para trocar a senha da sua conta.
    </p>
    <p style="margin:0 0 26px;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:${COR.apoio}">
      É só clicar no botão e escolher uma nova. Leva menos de um minuto.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:0 0 26px">
      ${botao('Criar uma senha nova', URL_DO_SUPABASE)}
    </td></tr></table>

    <p style="margin:0 0 26px;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:12.5px;line-height:1.6;color:${COR.fraco}">
      Se o botão não abrir, copie este endereço:<br>
      <span style="word-break:break-all;color:${COR.verde}">${URL_DO_SUPABASE}</span>
    </p>

    ${destaque(
      'Não foi você?',
      'Pode ignorar este e-mail. Sua senha continua a mesma enquanto ninguém abrir o link acima, e ele perde a validade sozinho.',
    )}`

  return {
    assunto: 'Trocar a senha da sua conta',
    html: casca({
      preheader: 'É só clicar no botão e escolher uma senha nova.',
      eyebrow: 'Sua conta',
      titulo: 'Vamos trocar sua senha',
      corpo,
    }),
  }
}

export function montaTrocaDeEmail(): { assunto: string; html: string } {
  const corpo = `
    <p style="margin:0 0 18px;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:${COR.texto}">
      Oi! Você pediu para trocar o e-mail de acesso da sua conta.
    </p>
    <p style="margin:0 0 26px;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:${COR.apoio}">
      Confirme aqui e o novo endereço passa a valer. Até você confirmar, nada muda.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:0 0 26px">
      ${botao('Confirmar meu e-mail', URL_DO_SUPABASE)}
    </td></tr></table>

    <p style="margin:0 0 26px;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:12.5px;line-height:1.6;color:${COR.fraco}">
      Se o botão não abrir, copie este endereço:<br>
      <span style="word-break:break-all;color:${COR.verde}">${URL_DO_SUPABASE}</span>
    </p>

    ${destaque(
      'Não foi você?',
      'Ignore este e-mail. O endereço de acesso da sua conta só muda depois que alguém abrir o link acima.',
    )}`

  return {
    assunto: 'Confirme seu novo e-mail',
    html: casca({
      preheader: 'Confirme aqui e o novo endereço passa a valer.',
      eyebrow: 'Sua conta',
      titulo: 'Confirme seu novo e-mail',
      corpo,
    }),
  }
}

// `escapa` é reexportado para quem montar variação destes textos não esquecer
// que conteúdo vindo do banco precisa passar por ele.
export { escapa }
