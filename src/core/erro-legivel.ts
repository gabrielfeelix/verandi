/**
 * O que a pessoa lê quando alguma coisa quebra.
 *
 * Um erro de framework na tela é duas vezes ruim: não diz o que fazer, e diz em
 * inglês com um endereço de documentação para programador. "Minified React
 * error #441; visit https://react.dev/errors/441" apareceu para o dono de um
 * estúdio no meio de cadastrar uma modalidade — ele não tem o que fazer com
 * isso, e nem sabe se o cadastro foi salvo.
 *
 * A regra: mensagem que **nós** escrevemos passa inteira, porque foi escrita
 * para ser lida ("Faltou o DDD", "nome é obrigatório"). Qualquer outra coisa
 * vira uma frase em português que diz o que aconteceu, que já sabemos, e para
 * onde escrever. O texto técnico continua existindo no console e no alerta
 * interno — para nós, não para quem está tentando trabalhar.
 */

export const CONTATO = 'contato@4yu.com.br'

/** O que denuncia mensagem de framework, não de produto. */
const TECNICO = [
  /minified react error/i,
  /react\.dev\/errors/i,
  /hydrat/i,
  /^\w*error:/i,
  /undefined is not|is not a function|cannot read prop/i,
  /fetch failed|networkerror|failed to fetch/i,
  /^\s*$/,
]

export function erroLegivel(e: unknown): string {
  const cru = e instanceof Error ? e.message : typeof e === 'string' ? e : ''

  const nosso = cru && !TECNICO.some((r) => r.test(cru)) && cru.length < 160
  if (nosso) return cru

  return `Alguma coisa quebrou aqui, e o erro é nosso, não seu. Já fomos avisados e vamos corrigir. Se travou o seu trabalho, escreva para ${CONTATO} contando o que estava fazendo.`
}
