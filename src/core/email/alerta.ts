import { COR, casca, destaque, escapa } from './leiaute'

/**
 * O e-mail que avisa que a Verandi quebrou.
 *
 * Este é o único e-mail do produto que **não** é para o cliente, e o texto muda
 * inteiro por causa disso: quem lê é quem pode consertar, às sete da manhã, do
 * celular. Ele precisa decidir em três segundos se levanta da mesa, e para isso
 * precisa de três coisas, nesta ordem: onde quebrou, quantas vezes, e o que
 * dizia.
 *
 * Nada de "identificamos uma instabilidade". Nada de tranquilizar.
 */

export type DadosDoAlerta = {
  onde: string
  mensagem: string
  ocorrencias: number
  primeiroEm: string
  ambiente: string
}

export function montaAlerta(d: DadosDoAlerta): {
  assunto: string
  html: string
  texto: string
} {
  const repetiu = d.ocorrencias > 1
  const assunto = repetiu
    ? `Verandi: ${d.onde} falhou ${d.ocorrencias} vezes`
    : `Verandi: ${d.onde} falhou`

  const texto = [
    `Onde: ${d.onde}`,
    `Quando: desde ${d.primeiroEm}`,
    `Vezes: ${d.ocorrencias}`,
    `Ambiente: ${d.ambiente}`,
    '',
    'Mensagem:',
    d.mensagem,
    '',
    'O detalhe completo está no log da Vercel, no deploy em produção.',
    'Este aviso não se repete pela próxima hora, mas a contagem continua.',
  ].join('\n')

  const corpo = `
    <p style="margin:0 0 18px;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:${COR.texto}">
      <strong style="font-weight:600">${escapa(d.onde)}</strong> devolveu erro${repetiu ? `, ${d.ocorrencias} vezes` : ''}.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
      style="background:${COR.afundado};border:1px solid ${COR.linhaSuave};border-radius:10px"><tr>
      <td style="padding:16px 18px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;line-height:1.6;color:${COR.texto};word-break:break-word">
        ${escapa(d.mensagem)}
      </td>
    </tr></table>

    <p style="margin:18px 0 26px;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.7;color:${COR.apoio}">
      Primeira vez: ${escapa(d.primeiroEm)}<br>
      Ambiente: ${escapa(d.ambiente)}
    </p>

    ${destaque(
      'Para não virar ruído',
      'Este aviso não se repete pela próxima hora. A contagem continua correndo, e o próximo e-mail diz quantas vezes aconteceu no silêncio.',
    )}`

  return {
    assunto,
    texto,
    html: casca({
      preheader: `${d.onde}: ${d.mensagem.slice(0, 90)}`,
      eyebrow: 'Alerta',
      titulo: 'A Verandi devolveu erro',
      corpo,
    }),
  }
}
