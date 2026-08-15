/**
 * A casca de todo e-mail da Verandi.
 *
 * E-mail não é página. O que vale aqui é outro conjunto de regras, e cada uma
 * delas custou a alguém antes de nós:
 *
 * - **Tabela, não `div`.** O Outlook clássico renderiza com o motor do Word:
 *   sem flexbox, sem grid, sem `position`. Layout em `div` chega torto e você
 *   só descobre pelo print de um cliente.
 * - **Estilo em `style=`, nunca em folha.** Gmail descarta `<style>` em boa
 *   parte dos casos.
 * - **Fundo branco explícito.** O Gmail aplica o modo escuro dele e ignora
 *   `prefers-color-scheme`; `#FFFFFF` ele converte para um cinza escuro que
 *   fica apresentável. Fundo transparente vira loteria.
 * - **Nada acima de 102 KB.** O Gmail corta o corpo aí e esconde o resto — o
 *   que costuma incluir o botão. Sem imagem embutida, esta casca fica em ~8 KB.
 * - **Sem imagem hospedada.** O app ainda não está no ar, e imagem quebrada é
 *   pior que imagem nenhuma. O visual sai de cor, tipo e espaço.
 *
 * As cores e as famílias vêm de `Design system Verandi-att/DESIGN-SYSTEM.md`.
 * Onde este arquivo divergir dele, é este que está errado.
 */

export const COR = {
  tinta: '#12211C',
  tinta2: '#173029',
  menta: '#2AC3A3',
  verde: '#0E7C6B',
  papel: '#EEF1EF',
  superficie: '#FFFFFF',
  afundado: '#F6F8F7',
  linha: '#DFE5E2',
  linhaSuave: '#EFF3F1',
  texto: '#141A18',
  apoio: '#5D6B66',
  // 4,93:1 sobre o fundo afundado do e-mail. O tom do protótipo dava 3,3:1, e
  // cliente de e-mail não deixa o leitor aumentar contraste como o navegador
  fraco: '#656E6A',
} as const

/** DM Sans para tudo; quem não carregar cai numa pilha decente do sistema. */
const CORPO = "'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
/** Bricolage só em título, como manda o design system. */
const TITULO = "'Bricolage Grotesque','DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

export function escapa(bruto: string): string {
  return bruto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Botão que sobrevive ao Outlook.
 *
 * O bloco `<!--[if mso]>` é VML, e só o Outlook lê. Sem ele, o botão perde o
 * fundo e vira um link solto no meio do e-mail — o clique some justamente onde
 * a mensagem inteira queria chegar.
 */
export function botao(rotulo: string, href: string): string {
  const url = escapa(href)
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td>
    <!--[if mso]>
    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
      href="${url}" style="height:50px;v-text-anchor:middle;width:260px" arcsize="16%" stroke="f" fillcolor="${COR.tinta}">
      <w:anchorlock/>
      <center style="color:#FFFFFF;font-family:Helvetica,Arial,sans-serif;font-size:16px;font-weight:600">${escapa(rotulo)}</center>
    </v:roundrect>
    <![endif]-->
    <!--[if !mso]><!-- -->
    <a href="${url}" style="background:${COR.tinta};border-radius:8px;color:#FFFFFF;display:inline-block;font-family:${CORPO};font-size:16px;font-weight:600;line-height:50px;text-align:center;text-decoration:none;width:260px;-webkit-text-size-adjust:none">${escapa(rotulo)}</a>
    <!--<![endif]-->
  </td></tr></table>`
}

/** Item da lista de "o que você vai poder fazer": bolinha menta + texto. */
export function item(titulo: string, apoio: string): string {
  return `
  <tr><td style="padding:0 0 18px">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
      <td width="28" valign="top" style="padding:3px 12px 0 0">
        <div style="width:16px;height:16px;border-radius:50%;background:${COR.menta}"></div>
      </td>
      <td valign="top" style="font-family:${CORPO};font-size:15px;line-height:1.5;color:${COR.texto}">
        <strong style="font-weight:600">${escapa(titulo)}</strong><br>
        <span style="color:${COR.apoio};font-size:14px">${escapa(apoio)}</span>
      </td>
    </tr></table>
  </td></tr>`
}

/** Caixa escura de destaque, no espírito do "POR QUE EXISTE" das referências. */
export function destaque(etiqueta: string, texto: string): string {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
    style="background:${COR.tinta};border-radius:12px"><tr>
    <td style="padding:20px 22px">
      <p style="margin:0 0 8px;font-family:${CORPO};font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:${COR.menta}">${escapa(etiqueta)}</p>
      <p style="margin:0;font-family:${CORPO};font-size:14.5px;line-height:1.55;color:#DCE6E2">${escapa(texto)}</p>
    </td>
  </tr></table>`
}

export type Casca = {
  /** Vai na aba do cliente e na prévia da caixa de entrada. */
  preheader: string
  /** Palavra curta acima do título, em menta. */
  eyebrow: string
  titulo: string
  /** HTML já montado — use `item`, `destaque`, `botao`. */
  corpo: string
  /**
   * O negócio de quem é a agenda. Vai no rodapé, e é o que responde "por que
   * estou recebendo isto?" — a pergunta que decide entre ler e marcar spam.
   */
  conta?: string
}

/**
 * Monta o documento inteiro.
 *
 * O `preheader` escondido é o texto que aparece na lista de e-mails, ao lado do
 * assunto. Sem ele o cliente mostra o primeiro texto que encontrar no HTML —
 * costuma ser "Se você não esperava este e-mail", que é a pior primeira
 * impressão possível.
 */
export function casca(c: Casca): string {
  return `<!doctype html>
<html lang="pt-BR" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${COR.papel};-webkit-font-smoothing:antialiased">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${escapa(c.preheader)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${COR.papel}">
<tr><td align="center" style="padding:32px 16px">

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560"
    style="width:560px;max-width:560px;background:${COR.superficie};border-radius:18px;overflow:hidden">

    <tr><td style="background:${COR.tinta};background-image:linear-gradient(180deg,${COR.tinta},${COR.tinta2});padding:38px 36px 34px">
      <p style="margin:0 0 14px;font-family:${CORPO};font-size:12px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:${COR.menta}">${escapa(c.eyebrow)}</p>
      <h1 style="margin:0;font-family:${TITULO};font-size:29px;line-height:1.22;font-weight:600;color:#FFFFFF">${escapa(c.titulo)}</h1>
    </td></tr>

    <tr><td style="padding:34px 36px 38px">${c.corpo}</td></tr>

    <tr><td style="background:${COR.afundado};border-top:1px solid ${COR.linhaSuave};padding:22px 36px">
      <p style="margin:0 0 4px;font-family:${CORPO};font-size:13px;line-height:1.6;color:${COR.apoio}">Um abraço,<br><strong style="color:${COR.texto};font-weight:600">Equipe Verandi</strong></p>
      <p style="margin:12px 0 0;font-family:${CORPO};font-size:11.5px;line-height:1.6;color:${COR.fraco}">Você recebeu este e-mail porque ${c.conta ? `o <strong style="font-weight:600;color:${COR.apoio}">${escapa(c.conta)}</strong> usa` : 'o seu negócio usa'} a Verandi para organizar a agenda.</p>
    </td></tr>

  </table>

</td></tr>
</table>
</body>
</html>`
}
