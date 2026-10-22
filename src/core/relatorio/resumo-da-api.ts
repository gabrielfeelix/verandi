import type { StatusParticipacao } from '@/core/agenda/ocupacao'

/**
 * O resumo do período que a API devolve para o AutoFluxos (`GET /relatorio`).
 *
 * É o que o relatório de Vendas do outro lado não tem como saber sozinho:
 * presença e falta, reposição, aula experimental que virou matrícula e quem
 * saiu. O AutoFluxos nunca lê o banco daqui; ele pergunta, e a conta é feita
 * aqui, perto de quem conhece as tabelas.
 *
 * As definições, todas no período pedido:
 *
 * - **presença** é sobre aula que já aconteceu e não foi cancelada pela casa;
 *   a taxa conta presente sobre presente, falta e falta avisada. Licença fica
 *   fora: é ausência combinada, não falta.
 * - **experimental que virou matrícula**: a pessoa fez experimental no
 *   período e tem contrato que começa no dia da experimental ou depois, até
 *   hoje. Experimental cancelada não conta.
 * - **matrícula nova**: o primeiro contrato da pessoa começa no período.
 *   Renovação não é matrícula.
 * - **saiu**: o contrato encerrou no período e ela não tem outro ativo ou
 *   pausado hoje. Trocar de plano não é sair.
 */

export type ParticipacaoParaResumo = {
  pessoaId: string
  status: StatusParticipacao
  origem: string
  /** O dia da aula, no fuso da conta (`aaaa-mm-dd`). */
  dia: string
  aulaJaAconteceu: boolean
  aulaCancelada: boolean
}

export type ContratoParaResumo = {
  pessoaId: string
  inicio: string
  fim: string | null
  status: 'ativo' | 'pausado' | 'encerrado'
}

export type ResumoDoPeriodo = {
  presencas: number
  faltas: number
  faltasAvisadas: number
  /** De 0 a 1; `null` sem aula com chamada no período. */
  taxaDePresenca: number | null
  reposicoesFeitas: number
  experimentais: number
  experimentaisQueMatricularam: number
  matriculasNovas: number
  sairam: number
  alunosAtivos: number
}

export function resumirPeriodo(
  participacoes: readonly ParticipacaoParaResumo[],
  contratos: readonly ContratoParaResumo[],
  de: string,
  ate: string,
): ResumoDoPeriodo {
  const dadas = participacoes.filter((p) => p.aulaJaAconteceu && !p.aulaCancelada)
  const presencas = dadas.filter((p) => p.status === 'presente').length
  const faltas = dadas.filter((p) => p.status === 'falta').length
  const faltasAvisadas = dadas.filter((p) => p.status === 'falta_avisada').length
  const comChamada = presencas + faltas + faltasAvisadas

  // A primeira experimental de cada pessoa no período.
  const experimental = new Map<string, string>()
  for (const p of participacoes) {
    if (p.origem !== 'experimental' || p.status === 'cancelada' || p.aulaCancelada) continue
    const antes = experimental.get(p.pessoaId)
    if (!antes || p.dia < antes) experimental.set(p.pessoaId, p.dia)
  }
  const matriculou = [...experimental].filter(([pessoa, dia]) =>
    contratos.some((c) => c.pessoaId === pessoa && c.inicio >= dia),
  ).length

  const primeiro = new Map<string, string>()
  for (const c of contratos) {
    const antes = primeiro.get(c.pessoaId)
    if (!antes || c.inicio < antes) primeiro.set(c.pessoaId, c.inicio)
  }
  const vigente = new Set(contratos.filter((c) => c.status !== 'encerrado').map((c) => c.pessoaId))
  const sairam = new Set(
    contratos
      .filter((c) => c.status === 'encerrado' && c.fim !== null && c.fim >= de && c.fim <= ate && !vigente.has(c.pessoaId))
      .map((c) => c.pessoaId),
  )

  return {
    presencas,
    faltas,
    faltasAvisadas,
    taxaDePresenca: comChamada === 0 ? null : presencas / comChamada,
    reposicoesFeitas: dadas.filter((p) => p.origem === 'reposicao' && p.status === 'presente').length,
    experimentais: experimental.size,
    experimentaisQueMatricularam: matriculou,
    matriculasNovas: [...primeiro.values()].filter((d) => d >= de && d <= ate).length,
    sairam: sairam.size,
    alunosAtivos: new Set(contratos.filter((c) => c.status === 'ativo').map((c) => c.pessoaId)).size,
  }
}
