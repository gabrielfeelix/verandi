/**
 * Como quem recebe prova que o evento veio de nós.
 *
 * Puro de propósito: a assinatura é o tipo de coisa que se escreve dentro do
 * entregador e ninguém testa, e o erro dela é silencioso dos dois lados. Quem
 * recebe implementa a conferência errada, ela passa a aceitar tudo, e o webhook
 * vira uma URL pública que qualquer um pode chamar dizendo que uma aula foi
 * cancelada.
 */

/** O cabeçalho que leva a assinatura, e o que carrega o instante. */
export const CABECALHO_ASSINATURA = 'Verandi-Signature'
export const CABECALHO_INSTANTE = 'Verandi-Timestamp'
export const CABECALHO_EVENTO = 'Verandi-Event'

/**
 * O texto que é assinado.
 *
 * O instante entra na conta, e não só no cabeçalho, porque senão ele não está
 * protegido: quem interceptasse poderia guardar a requisição inteira e repetir
 * amanhã, com a assinatura ainda válida. Assinando `instante.corpo`, mudar o
 * instante invalida a assinatura, e quem recebe pode recusar o que é velho
 * demais.
 */
export function textoAssinado(instante: number, corpo: string): string {
  return `${instante}.${corpo}`
}

/**
 * A janela em que uma entrega é aceita, em segundos.
 *
 * Cinco minutos é folgado para relógio desalinhado e apertado para reenvio
 * malicioso. Quem recebe é que aplica isso; nós documentamos para ele saber que
 * pode.
 */
export const JANELA_SEGUNDOS = 300

/**
 * Quando tentar de novo, em segundos, a partir do número de tentativas já
 * feitas.
 *
 * Cresce, e para. Cresce porque o motivo mais comum de falha é o outro lado
 * estar de pé em um minuto, e insistir de segundo em segundo só transforma a
 * indisponibilidade dele em ataque nosso. Para porque fila que tenta para sempre
 * é fila que enche para sempre, e um evento de aula de terça não interessa mais
 * na sexta.
 *
 * São seis tentativas em pouco mais de duas horas, o que cobre a queda curta e a
 * reinicialização. Depois disso, o evento fica registrado como não entregue, com
 * o último erro, para alguém olhar.
 */
const ESPERA = [30, 120, 300, 900, 3600, 7200] as const

export const MAXIMO_DE_TENTATIVAS = ESPERA.length

export function proximaEspera(tentativasFeitas: number): number | null {
  return ESPERA[tentativasFeitas] ?? null
}
