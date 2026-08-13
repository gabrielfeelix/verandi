import { diaDaSemanaDe, somarDias } from './datas'
import type { Excecao, Ocorrencia, Serie } from './tipos'

/**
 * Uma série mais um intervalo viram a lista de ocorrências previstas.
 *
 * Não toca em banco e não sabe o que é fuso: recebe e devolve data em string
 * `YYYY-MM-DD`, que compara lexicograficamente na ordem certa.
 *
 * Dia bloqueado por feriado ou fechamento **continua na lista**, marcado. Some
 * da grade é pior que aparecer riscado — some gera a pergunta "cadê a aula".
 */
export function expandirSerie(
  serie: Serie,
  de: string,
  ate: string,
  excecoes: Excecao[],
): Ocorrencia[] {
  if (!serie.ativo) return []
  if (ate < de) return []

  const bloqueio = new Map(excecoes.map((e) => [e.data, e.tipo]))

  const inicio = de > serie.vigenciaInicio ? de : serie.vigenciaInicio
  const fim =
    serie.vigenciaFim !== null && serie.vigenciaFim < ate ? serie.vigenciaFim : ate

  const saida: Ocorrencia[] = []
  for (let d = inicio; d <= fim; d = somarDias(d, 1)) {
    if (diaDaSemanaDe(d) !== serie.diaSemana) continue
    const motivo = bloqueio.get(d)
    saida.push({
      serieId: serie.id,
      data: d,
      horaInicio: serie.horaInicio,
      duracaoMin: serie.duracaoMin,
      capacidade: serie.capacidade,
      bloqueada: motivo !== undefined,
      ...(motivo !== undefined ? { motivo } : {}),
    })
  }
  return saida
}
