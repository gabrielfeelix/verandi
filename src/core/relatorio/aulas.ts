import type { StatusParticipacao } from '@/core/agenda/ocupacao'
import { estadoDaChamada } from '@/core/agenda/chamada'

/**
 * Quantas aulas cada profissional aplicou.
 *
 * Sem banco e sem tela: a tela, a planilha e um dia a API precisam do mesmo
 * número, e contagem escrita em dois lugares diverge no dia em que só uma delas
 * passar a ignorar o feriado.
 *
 * A pergunta que decide tudo é o que conta como "aula aplicada", e a resposta
 * está no plano 19: **a sessão que já passou e não foi cancelada**. O
 * profissional foi ao estúdio, esperou, e turma vazia não é culpa dele. As
 * outras três leituras possíveis (teve chamada, teve presença, existiu na
 * agenda) ficam ao lado, para quem lê conferir em vez de acreditar.
 */

export type SessaoParaContar = {
  profissionalId: string | null
  profissionalNome: string
  /** o instante de início, em ISO; comparado contra `agora` */
  inicio: string
  cancelada: boolean
  /** o motivo escrito pela materialização quando o dia foi bloqueado */
  motivoCancelamento: string | null
  status: StatusParticipacao[]
}

export type AulasDoProfissional = {
  profissionalId: string | null
  profissionalNome: string
  /** o número grande: passou e não foi cancelada */
  aplicadas: number
  /** dessas, quantas tiveram pelo menos uma pessoa presente */
  comPresenca: number
  /** dessas, quantas ninguém apareceu, com a chamada registrada */
  semNinguem: number
  /** dessas, quantas ninguém registrou: o total ainda não está conferido */
  semChamada: number
  /** quantas pessoas foram atendidas ao todo, somando as turmas */
  atendimentos: number
  /** marcadas no período e ainda não acontecidas */
  aindaPorDar: number
  canceladas: number
  /** dessas, quantas caíram por feriado ou fechamento do estúdio */
  porFeriado: number
}

/**
 * O motivo que a materialização escreve quando o dia está bloqueado é
 * `Dia marcado como feriado` ou `Dia marcado como fechado`.
 *
 * Ler o texto é frágil e é o que existe: a sessão cancelada não guarda o tipo
 * da exceção, e a alternativa seria cruzar cada sessão com o calendário para
 * distinguir feriado de "a professora avisou que não vinha". Se um dia a coluna
 * existir, esta função é o único lugar a mudar.
 */
export function canceladaPorFeriado(motivo: string | null): boolean {
  if (!motivo) return false
  return /dia marcado como (feriado|fechado)/i.test(motivo)
}

const PRESENTE: ReadonlySet<string> = new Set(['presente'])

/**
 * A contagem por profissional, do que mais deu aula para o que menos deu.
 *
 * `agora` entra como argumento porque o `core/` não sabe que horas são no fuso
 * da conta, e porque um relatório do mês corrente precisa separar o que já
 * aconteceu do que está marcado para a semana que vem.
 *
 * Sessão sem profissional não é descartada: ela vira uma linha "Sem
 * profissional", que é exatamente o que o dono precisa ver para ir corrigir a
 * grade. Descartar em silêncio faria a soma das linhas não bater com o total de
 * aulas do estúdio.
 */
export function aulasPorProfissional(
  sessoes: SessaoParaContar[], agora: string,
): AulasDoProfissional[] {
  const mapa = new Map<string, AulasDoProfissional>()

  for (const s of sessoes) {
    const chave = s.profissionalId ?? 'sem-profissional'
    const linha = mapa.get(chave) ?? {
      profissionalId: s.profissionalId,
      profissionalNome: s.profissionalNome,
      aplicadas: 0, comPresenca: 0, semNinguem: 0, semChamada: 0,
      atendimentos: 0, aindaPorDar: 0, canceladas: 0, porFeriado: 0,
    }

    if (s.cancelada) {
      linha.canceladas += 1
      if (canceladaPorFeriado(s.motivoCancelamento)) linha.porFeriado += 1
    } else if (s.inicio > agora) {
      // aula futura não é aula aplicada: somá-la faria o relatório do dia 3
      // ser promessa e o do dia 30 ser fato, com o mesmo rótulo
      linha.aindaPorDar += 1
    } else {
      linha.aplicadas += 1
      const presentes = s.status.filter((x) => PRESENTE.has(x)).length
      linha.atendimentos += presentes
      if (estadoDaChamada(s.status) === 'pendente') linha.semChamada += 1
      else if (presentes > 0) linha.comPresenca += 1
      else linha.semNinguem += 1
    }

    mapa.set(chave, linha)
  }

  return [...mapa.values()].sort(
    (a, b) => b.aplicadas - a.aplicadas
      || a.profissionalNome.localeCompare(b.profissionalNome, 'pt-BR'),
  )
}

/** Os totais do estúdio, que são a soma das linhas e não outra consulta. */
export function totalDoPeriodo(linhas: AulasDoProfissional[]): {
  aplicadas: number
  atendimentos: number
  semChamada: number
  canceladas: number
  porFeriado: number
  aindaPorDar: number
} {
  return linhas.reduce((t, l) => ({
    aplicadas: t.aplicadas + l.aplicadas,
    atendimentos: t.atendimentos + l.atendimentos,
    semChamada: t.semChamada + l.semChamada,
    canceladas: t.canceladas + l.canceladas,
    porFeriado: t.porFeriado + l.porFeriado,
    aindaPorDar: t.aindaPorDar + l.aindaPorDar,
  }), {
    aplicadas: 0, atendimentos: 0, semChamada: 0,
    canceladas: 0, porFeriado: 0, aindaPorDar: 0,
  })
}

/**
 * A frase que explica o total, para ele nunca ser lido sozinho.
 *
 * "18 aulas" não diz se o mês foi bom ou se faltou registrar chamada em seis
 * delas. Quem lê um relatório de outra pessoa precisa da ressalva junto do
 * número, e não no rodapé.
 */
export function ressalvaDoTotal(t: {
  semChamada: number
  porFeriado: number
  aindaPorDar: number
}): string | null {
  const partes: string[] = []
  if (t.semChamada > 0) partes.push(`${t.semChamada} sem chamada registrada`)
  if (t.porFeriado > 0) {
    partes.push(`${t.porFeriado} ${t.porFeriado === 1
      ? 'dia fechado' : 'dias fechados'} no período`)
  }
  if (t.aindaPorDar > 0) {
    partes.push(`${t.aindaPorDar} ainda por dar`)
  }
  return partes.length ? partes.join(' · ') : null
}
