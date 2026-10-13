export type StatusParticipacao =
  | 'esperada' | 'confirmada' | 'presente'
  | 'falta' | 'falta_avisada' | 'licenca' | 'cancelada'

/**
 * Os status que devolvem o lugar **daquela aula** para a sessão.
 *
 * `falta_avisada` libera de propósito: é o que faz "avisei que não vou" abrir
 * espaço para a reposição de outra pessoa, e é o que dá sentido à confirmação
 * pelo bot.
 *
 * `licenca` também libera, desde 06/out/2026, pelo mesmo motivo: a pessoa não
 * vem, e quatro semanas de licença eram quatro aulas com lugar vazio que
 * ninguém podia ocupar. O que fica guardado é o **horário fixo** (a `vaga`),
 * não o lugar de cada aula: ela volta para o mesmo horário, e se a aula
 * estiver cheia de encaixes quando voltar, entra acima da capacidade.
 */
const LIBERAM_A_VAGA: ReadonlySet<string> = new Set(['falta_avisada', 'cancelada', 'licenca'])

/**
 * Quem sai de um horário devendo uma reposição.
 *
 * Existe como uma lista só porque a mesma pergunta é feita em quatro lugares
 * (`/pendencias`, a ficha da pessoa, o menu "apontar reposição" e o que já foi
 * reposto), e três listas escritas à mão discordam no dia em que a quarta muda.
 *
 * `falta_avisada` entra **se a conta quiser**: é a pergunta de Padrões, "avisar
 * antes dá direito a repor?". `cancelada` entra sempre e não se pergunta, porque
 * é o negócio que fechou o dia ou tirou a pessoa do horário, e o lugar era dela.
 * `licenca` fica de fora: quem está afastado mantém o horário fixo, não perdeu nada.
 */
export function statusComCredito(creditoFaltaAvisada: boolean): StatusParticipacao[] {
  return creditoFaltaAvisada
    ? ['falta', 'falta_avisada', 'cancelada']
    : ['falta', 'cancelada']
}

/**
 * Os status em que a aula de reposição **não repõe** nada.
 *
 * Quem falta à reposição não pagou a falta antiga: ela volta a ficar em aberto,
 * e a falta na reposição não vira um crédito novo, senão a pessoa sairia com
 * dois. A ligação (`reposicao_de_id`) fica, para se saber qual falta aquela
 * aula ia pagar e para valer de novo se a chamada for corrigida para presente.
 * Até 13/out/2026 a falta na reposição contava como reposição feita (MGM,
 * Giovanna e Gustavo, 13/10 8h).
 */
export const NAO_REPOEM: readonly StatusParticipacao[] = ['falta', 'falta_avisada', 'cancelada', 'licenca']

/** `NAO_REPOEM` no formato do filtro `.not('status', 'in', ...)` do PostgREST */
export const FILTRO_NAO_REPOEM = `(${NAO_REPOEM.join(',')})`

export type Ocupacao = {
  capacidade: number
  ocupadas: number
  livres: number
  lotada: boolean
  excedida: boolean
}

export function calcularOcupacao(
  capacidade: number,
  status: StatusParticipacao[],
): Ocupacao {
  const ocupadas = status.filter((s) => !LIBERAM_A_VAGA.has(s)).length
  return {
    capacidade,
    ocupadas,
    livres: Math.max(0, capacidade - ocupadas),
    lotada: ocupadas >= capacidade,
    excedida: ocupadas > capacidade,
  }
}
