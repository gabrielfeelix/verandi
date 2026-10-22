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
export function statusComCredito(
  creditoFaltaAvisada: boolean,
  /**
   * Falta sem aviso gera crédito? `credito_falta` da conta, desde a `0076`. Na
   * MGM não gera: só a justificada dá direito a repor.
   */
  creditoFalta = true,
): StatusParticipacao[] {
  return [
    ...(creditoFalta ? ['falta' as const] : []),
    ...(creditoFaltaAvisada ? ['falta_avisada' as const] : []),
    'cancelada',
  ]
}

/**
 * Os status em que a aula de reposição **não repõe** nada: a falta antiga
 * volta a ficar em aberto.
 *
 * Faltar na reposição segue a regra de faltar numa aula comum: a falta antiga
 * só volta se essa falta daria direito a repor (`statusComCredito` com as
 * regras da conta), ou se a aula foi cancelada ou era licença. Senão, a
 * reposição foi perdida e paga a falta antiga.
 *
 * A aula que é reposição de outra nunca abre crédito próprio, senão a pessoa
 * sairia com dois. A ligação (`reposicao_de_id`) fica, e tudo volta se a
 * chamada for corrigida.
 *
 * Até 13/out/2026 a falta na reposição contava como reposição feita (MGM,
 * Giovanna e Gustavo). De 13 a 22/out ela devolvia a falta antiga sempre,
 * mesmo sem aviso, e na MGM, onde falta sem aviso não dá crédito, a aluna
 * que faltou na reposição ganhava a aula de volta (Carolina Garcia, 21/10 9h).
 */
export function naoRepoem(creditoFaltaAvisada: boolean, creditoFalta = true): StatusParticipacao[] {
  return [...statusComCredito(creditoFaltaAvisada, creditoFalta), 'licenca']
}

/** `naoRepoem` no formato do filtro `.not('status', 'in', ...)` do PostgREST */
export function filtroNaoRepoem(creditoFaltaAvisada: boolean, creditoFalta = true): string {
  return `(${naoRepoem(creditoFaltaAvisada, creditoFalta).join(',')})`
}

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
