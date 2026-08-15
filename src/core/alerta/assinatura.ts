/**
 * Quando dois erros são o mesmo erro.
 *
 * Esta é a única pergunta difícil do monitoramento barato, e errá-la estraga as
 * duas pontas: assinatura frouxa demais junta defeitos diferentes num alerta só
 * e esconde o segundo; assinatura estrita demais faz o mesmo defeito virar
 * quatrocentos alertas, porque o id da pessoa muda a cada requisição.
 *
 * Puro, e com teste, porque é regra e não encanamento.
 */

/**
 * Tira da mensagem tudo que muda entre duas ocorrências do mesmo defeito.
 *
 * A lista é curta de propósito e cresce quando um alerta repetido provar que
 * falta um caso. Adivinhar padrões que não aconteceram é como se escreve um
 * normalizador que ninguém entende seis meses depois.
 */
export function normaliza(mensagem: string): string {
  return mensagem
    // uuid: o id da pessoa, da sessão, da conta
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<id>')
    // data e hora, que aparecem em erro de consulta por período
    .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z?/g, '<instante>')
    .replace(/\d{4}-\d{2}-\d{2}/g, '<data>')
    // qualquer número solto de três dígitos ou mais: contagem, porta, linha
    .replace(/\b\d{3,}\b/g, '<n>')
    .trim()
    .slice(0, 300)
}

/**
 * A assinatura de um erro: onde aconteceu, mais a mensagem sem o que varia.
 *
 * O lugar entra porque a mesma mensagem em dois lugares costuma ser dois
 * defeitos. "Não encontrado" na rota de pessoas e na de sessões são problemas
 * diferentes, e juntá-los faria o segundo nunca ser avisado.
 */
export function assinaturaDoErro(onde: string, mensagem: string): string {
  return `${onde}|${normaliza(mensagem)}`
}

/**
 * Quanto tempo ficar calado sobre o mesmo erro, em minutos.
 *
 * Uma hora. Curto o bastante para um defeito novo aparecer no mesmo turno de
 * trabalho, e longo o bastante para uma tela quebrada não encher a caixa. O
 * contador de ocorrências continua subindo em silêncio, então o segundo e-mail
 * chega dizendo "aconteceu mais 312 vezes", que é a informação que realmente
 * muda a decisão.
 */
export const SILENCIO_MINUTOS = 60
