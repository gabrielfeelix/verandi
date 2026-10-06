import type { StatusParticipacao } from './ocupacao'

/**
 * A licença vale para o período inteiro, não aula por aula (decisão de
 * 06/out/2026).
 *
 * Antes, só a aula marcada na chamada virava `licenca`; as seguintes ficavam
 * `esperada` e seguravam um lugar que ninguém ia usar. Agora abrir, prorrogar
 * ou encerrar a licença acerta todas as aulas que ainda não começaram, e esta
 * é a regra de quais.
 */

/** O período da licença em datas locais. A volta é o dia em que ela já vem. */
export type JanelaDeLicenca = { inicio: string; voltaPrevista: string | null }

/** A aula cai dentro da licença: do início até a véspera da volta, ou sem fim. */
export function dentroDaLicenca(data: string, janela: JanelaDeLicenca): boolean {
  if (data < janela.inicio) return false
  return janela.voltaPrevista === null || data < janela.voltaPrevista
}

export type AulaDaPessoa = {
  participacaoId: string
  sessaoId: string
  status: StatusParticipacao
  /** o instante em que a sessão começa, ISO */
  sessaoInicio: string
  /** a data local da sessão, no fuso da conta */
  data: string
}

const AGUARDANDO: ReadonlySet<StatusParticipacao> = new Set(['esperada', 'confirmada'])

/**
 * O que muda nas aulas da pessoa para bater com a licença.
 *
 * `janela` nula é a licença encerrada: toda aula futura em `licenca` volta a
 * `esperada`, mesmo com a turma cheia, porque o horário fixo é dela. Passado
 * não muda: a aula que já começou é registro do que aconteceu.
 */
export function ajusteDaLicenca(
  aulas: AulaDaPessoa[],
  janela: JanelaDeLicenca | null,
  agora: number,
): { paraLicenca: AulaDaPessoa[]; paraEsperada: AulaDaPessoa[] } {
  const futuras = aulas.filter((a) => Date.parse(a.sessaoInicio) > agora)
  const dentro = (a: AulaDaPessoa) => janela !== null && dentroDaLicenca(a.data, janela)
  return {
    paraLicenca: futuras.filter((a) => AGUARDANDO.has(a.status) && dentro(a)),
    paraEsperada: futuras.filter((a) => a.status === 'licenca' && !dentro(a)),
  }
}
