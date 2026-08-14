/**
 * O que o Brevo conta de volta sobre um e-mail que saiu.
 *
 * Sem isto, bounce é invisível: a dona convida `maria@gmial.com` com o erro de
 * digitação, a tela diz "Convite enviado", o e-mail volta, e ninguém fica
 * sabendo até virar chamado para a 4YU.
 *
 * A tradução acontece aqui, e não na rota, por dois motivos: dá para testar sem
 * subir servidor, e o vocabulário do Brevo não vaza para dentro do produto —
 * `hard_bounce` é palavra deles, `voltou` é palavra nossa.
 */

/** O que a tela precisa saber. Menos estados que o Brevo, de propósito. */
export type EstadoDeEntrega = 'entregue' | 'voltou' | 'spam' | 'bloqueado'

/**
 * Nem todo evento vira estado.
 *
 * `request` só diz que pedimos o envio — a tela já sabe disso. `opened` e
 * `click` são sobre comportamento de quem recebeu, e guardar isso de um e-mail
 * de acesso é vigiar sem necessidade: não muda nenhuma decisão de quem opera, e
 * é dado pessoal a mais para justificar.
 *
 * `deferred` é atraso temporário, não falha: o servidor de destino pediu para
 * tentar depois. Marcar como problema faria a tela mentir e assustar à toa.
 */
const MAPA: Record<string, EstadoDeEntrega> = {
  delivered: 'entregue',
  hard_bounce: 'voltou',
  invalid_email: 'voltou',
  soft_bounce: 'voltou',
  error: 'voltou',
  spam: 'spam',
  complaint: 'spam',
  blocked: 'bloqueado',
  unsubscribed: 'bloqueado',
}

export function estadoDoEvento(evento: string): EstadoDeEntrega | null {
  return MAPA[String(evento || '').trim().toLowerCase()] ?? null
}

/**
 * Um estado pior nunca é apagado por um melhor que chegue depois.
 *
 * O Brevo entrega evento fora de ordem, e a mesma mensagem pode gerar
 * `delivered` e depois `spam` — a caixa aceitou e o filtro moveu. Se o último a
 * chegar vencesse, um `delivered` atrasado apagaria o `voltou` que é justamente
 * o que a dona precisa ver.
 */
const GRAVIDADE: Record<EstadoDeEntrega, number> = {
  entregue: 0,
  spam: 1,
  bloqueado: 2,
  voltou: 3,
}

export function piorEntre(
  atual: EstadoDeEntrega | null | undefined,
  novo: EstadoDeEntrega,
): EstadoDeEntrega {
  if (!atual) return novo
  return GRAVIDADE[novo] > GRAVIDADE[atual] ? novo : atual
}

/** O que a tela escreve para quem convidou. */
export function recadoDaEntrega(estado: EstadoDeEntrega): string {
  switch (estado) {
    case 'entregue':
      return 'e-mail entregue'
    case 'voltou':
      return 'o e-mail voltou, confira o endereço'
    case 'spam':
      return 'caiu como spam, mande o link direto'
    case 'bloqueado':
      return 'esse endereço está bloqueado, mande o link direto'
  }
}
