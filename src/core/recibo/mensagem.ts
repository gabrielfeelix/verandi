import { emReais } from '../planos/plano'
import {
  dataPorExtenso, documentoFormatado, localDeEmissao, numeroFormatado,
  quemAssina, type CorpoDoRecibo,
} from './recibo'

/**
 * O recibo como e-mail.
 *
 * O corpo da mensagem **é** o recibo, e não um aviso com link: quem recebe abre
 * no telefone, no meio da rua, e precisa ver o comprovante ali. Link exigiria
 * login, e o aluno não tem login neste produto.
 *
 * Sem `<style>` e sem classe: cliente de e-mail ignora folha de estilo e o
 * Gmail corta o `<head>` inteiro. Tudo vai em atributo `style` na tag, que é o
 * único jeito que atravessa os três clientes que importam.
 *
 * Sem imagem remota, nem a assinatura: a maioria dos clientes bloqueia imagem
 * por padrão, e um recibo cuja assinatura só aparece depois de "exibir imagens"
 * é um recibo que parece adulterado. A assinatura vai como texto identificado,
 * e o papel assinado continua sendo o impresso ou o salvo em PDF.
 */

const TINTA = '#1A1F1D'
const FRACA = '#5D6B66'
const LINHA = '#E3E8E5'

export function assuntoDoRecibo(
  serie: string, numero: number, emitente: string,
): string {
  return `Recibo ${numeroFormatado(serie, numero)} de ${emitente}`
}

export function textoDoRecibo(
  corpo: CorpoDoRecibo, serie: string, numero: number,
): string {
  const assina = quemAssina(corpo)
  const local = localDeEmissao(corpo.emitenteEndereco)
  return [
    `RECIBO Nº ${numeroFormatado(serie, numero)}`,
    '',
    `${corpo.emitenteNome}${corpo.emitenteDocumento ? ` · CNPJ/CPF ${documentoFormatado(corpo.emitenteDocumento)}` : ''}`,
    '',
    `Recebemos de ${corpo.pagadorNome}`
      + `${corpo.pagadorDocumento ? `, CPF ${documentoFormatado(corpo.pagadorDocumento)}` : ''}`
      + ` a importância de ${emReais(corpo.valorCent)} (${corpo.valorPorExtenso}),`
      + ` referente a ${corpo.referente}, pagos em ${corpo.forma}`
      + ` no dia ${dataPorExtenso(corpo.recebidoEm)}.`,
    '',
    `${local ? `${local}, ` : ''}${dataPorExtenso(corpo.emitidoEm.slice(0, 10))}.`,
    '',
    assina.nome + (assina.cargo ? ` · ${assina.cargo}` : ''),
    '',
    'Este documento é um recibo, e não uma nota fiscal.',
  ].join('\n')
}

export function htmlDoRecibo(
  corpo: CorpoDoRecibo, serie: string, numero: number, cancelado = false,
): string {
  const assina = quemAssina(corpo)
  const local = localDeEmissao(corpo.emitenteEndereco)
  const doc = documentoFormatado(corpo.emitenteDocumento)

  /*
   * O cancelado também é enviável, e vai marcado.
   *
   * É a segunda via que prova o cancelamento para quem guardou a antiga, e é
   * exatamente o caso em que reenviar importa. Sair sem marca seria a versão
   * por e-mail do defeito que o carimbo na folha existe para impedir.
   */
  const faixa = cancelado
    ? `<div style="background:#FBEAE7;color:#B4442E;padding:10px 14px;border-radius:8px;font:600 13px/1.4 system-ui,sans-serif;margin:0 0 16px">
         Este recibo foi cancelado e não comprova mais o pagamento.
       </div>`
    : ''

  return `<div style="max-width:560px;margin:0 auto;padding:24px;font:400 14px/1.6 system-ui,-apple-system,Segoe UI,sans-serif;color:${TINTA}">
  ${faixa}
  <table role="presentation" width="100%" style="border-collapse:collapse;margin:0 0 18px">
    <tr>
      <td style="vertical-align:top">
        <div style="font:600 16px/1.25 system-ui,sans-serif">${escapar(corpo.emitenteNome)}</div>
        ${doc ? `<div style="color:${FRACA};font-size:12px">CNPJ/CPF ${doc}</div>` : ''}
        ${corpo.emitenteEndereco ? `<div style="color:${FRACA};font-size:12px">${escapar(corpo.emitenteEndereco)}</div>` : ''}
      </td>
      <td style="vertical-align:top;text-align:right;white-space:nowrap">
        <div style="color:${FRACA};font-size:10px;letter-spacing:.12em;text-transform:uppercase">valor recebido</div>
        <div style="font:600 22px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace">${emReais(corpo.valorCent)}</div>
      </td>
    </tr>
  </table>

  <table role="presentation" width="100%" style="border-collapse:collapse;border-top:1px solid ${LINHA};border-bottom:1px solid ${LINHA};margin:0 0 16px">
    <tr>
      <td style="padding:9px 0;font:600 17px/1 system-ui,sans-serif;letter-spacing:.2em;text-transform:uppercase">Recibo</td>
      <td style="padding:9px 0;text-align:right;color:${FRACA};font-size:12px">
        nº <strong style="color:${TINTA};font-family:ui-monospace,SFMono-Regular,Menlo,monospace">${numeroFormatado(serie, numero)}</strong>
      </td>
    </tr>
  </table>

  <p style="margin:0 0 18px">
    Recebemos de <strong>${escapar(corpo.pagadorNome)}</strong>${
      corpo.pagadorDocumento ? `, CPF ${documentoFormatado(corpo.pagadorDocumento)}` : ''
    }${
      corpo.pagadorMatricula ? `, matrícula nº ${escapar(corpo.pagadorMatricula)}` : ''
    } a importância de <strong>${emReais(corpo.valorCent)}</strong>
    (<strong>${escapar(corpo.valorPorExtenso)}</strong>), referente a
    ${escapar(corpo.referente)}, pagos em ${escapar(corpo.forma)} no dia
    ${dataPorExtenso(corpo.recebidoEm)}.
  </p>

  <p style="margin:0 0 26px;font-size:13px">
    ${local ? `${escapar(local)}, ` : ''}${dataPorExtenso(corpo.emitidoEm.slice(0, 10))}.
  </p>

  <div style="border-top:1px solid ${TINTA};padding-top:6px;width:250px;margin-left:auto;text-align:center">
    <div style="font:500 13px/1.4 system-ui,sans-serif">${escapar(assina.nome)}</div>
    ${assina.cargo ? `<div style="color:${FRACA};font-size:11px">${escapar(assina.cargo)}</div>` : ''}
    ${doc ? `<div style="color:${FRACA};font-size:11px">${doc}</div>` : ''}
  </div>

  <p style="margin:26px 0 0;color:${FRACA};font-size:11px;line-height:1.5">
    Este documento é um recibo, e não uma nota fiscal.
    ${cancelado ? '' : 'Guarde esta mensagem: ela é o seu comprovante.'}
  </p>
</div>`
}

/**
 * Escapar o que veio de cadastro antes de virar HTML.
 *
 * Nome, endereço e "referente a" são digitados por gente, e vão inteiros para
 * dentro de uma mensagem que outro sistema vai renderizar. Um nome com `<` sem
 * escapar não é só HTML quebrado: é conteúdo do nosso domínio executando na
 * caixa de e-mail de outra pessoa.
 */
function escapar(bruto: string): string {
  return bruto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
