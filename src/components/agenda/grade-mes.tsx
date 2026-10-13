import Link from 'next/link'
import type { SessaoResumo } from '@/server/agenda/consultas'
import { diaDaSemanaDe, somarDias } from '@/core/agenda/datas'

const CABECALHO = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

/**
 * O mês inteiro, um quadrado por dia.
 *
 * A semana responde "o que tem quinta às 8h"; o mês responde as perguntas de
 * quem confere e planeja: em que dia de setembro ela faltou, que semana está
 * vazia, onde ainda cabe gente. Por isso cada dia diz quantas aulas teve e
 * quanto da vaga foi ocupado, e não quem estava em cada uma: isso é um clique,
 * que abre o dia.
 *
 * O dia de fora do mês aparece apagado e continua clicável: a primeira semana
 * de outubro começa em setembro, e esconder esses dias quebraria a leitura da
 * semana inteira.
 */
export function GradeMes({
  sessoes, mes, hoje, fechados, feriados, hrefDoDia, rotuloSessoes,
}: {
  sessoes: SessaoResumo[]
  /** `AAAA-MM` */
  mes: string
  hoje: string
  /** dias da semana (0 = domingo) em que a casa não abre */
  fechados: Set<number>
  feriados: Record<string, string>
  hrefDoDia: (dia: string) => string
  rotuloSessoes: string
}) {
  const primeiro = `${mes}-01`
  const d0 = diaDaSemanaDe(primeiro)
  const inicio = somarDias(primeiro, d0 === 0 ? -6 : 1 - d0)
  const semanas: string[][] = []
  for (let dia = inicio; dia.slice(0, 7) <= mes || semanas.length === 0; ) {
    const semana = Array.from({ length: 7 }, (_, i) => somarDias(dia, i))
    semanas.push(semana)
    dia = somarDias(dia, 7)
    if (dia.slice(0, 7) > mes) break
  }

  const porDia = new Map<string, { aulas: number; ocupadas: number; capacidade: number }>()
  for (const s of sessoes) {
    if (s.status === 'cancelada') continue
    const atual = porDia.get(s.data) ?? { aulas: 0, ocupadas: 0, capacidade: 0 }
    atual.aulas += 1
    atual.ocupadas += s.ocupacao.ocupadas
    atual.capacidade += s.ocupacao.capacidade
    porDia.set(s.data, atual)
  }

  return (
    <div className="overflow-hidden rounded-grande border border-linha bg-superficie">
      <div className="grid grid-cols-7 border-b border-linha bg-superficie-suave">
        {CABECALHO.map((d) => (
          <span key={d} className="py-2 text-center text-[12px] font-semibold text-tinta-media">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {semanas.flat().map((dia, i) => {
          const doMes = dia.slice(0, 7) === mes
          const resumo = porDia.get(dia)
          const fechado = fechados.has(diaDaSemanaDe(dia)) && !resumo
          const feriado = feriados[dia]
          const pct = resumo && resumo.capacidade > 0
            ? Math.round((resumo.ocupadas / resumo.capacidade) * 100)
            : 0
          const ehHoje = dia === hoje
          return (
            <Link
              key={dia}
              href={hrefDoDia(dia)}
              prefetch={false}
              aria-label={`${Number(dia.slice(8))}/${dia.slice(5, 7)}: ${
                resumo ? `${resumo.aulas} ${rotuloSessoes}, ${pct}% das vagas ocupadas` : fechado ? 'fechado' : 'nada marcado'
              }`}
              className={`flex min-h-[64px] flex-col gap-1 border-linha-fina p-1.5 transition-colors duration-150 hover:bg-superficie-mais-suave md:min-h-[104px] md:p-2.5 ${
                i % 7 === 6 ? '' : 'border-r'
              } ${i >= 7 ? 'border-t' : ''} ${
                fechado ? 'bg-neutro-fundo' : ''
              } ${doMes ? '' : 'opacity-45'}`}
            >
              <span className="flex items-center justify-between gap-1">
                <span
                  className={`inline-flex size-6 items-center justify-center rounded-full text-[13.5px] tabular-nums md:size-7 md:text-[14.5px] ${
                    ehHoje ? 'bg-escuro font-semibold text-tinta-clara' : 'font-medium'
                  }`}
                >
                  {Number(dia.slice(8))}
                </span>
                {resumo ? (
                  <span className="hidden text-[12px] text-tinta-media tabular-nums md:inline">
                    {pct}%
                  </span>
                ) : null}
              </span>

              {feriado ? (
                <>
                  <span aria-hidden className="size-1.5 rounded-full bg-atencao md:hidden" />
                  <span className="hidden truncate rounded-minima bg-atencao-fundo px-1 text-[12px] font-medium text-atencao md:block">
                    {feriado}
                  </span>
                </>
              ) : null}

              {resumo ? (
                <span className="mt-auto flex flex-col gap-1">
                  <span className="hidden text-[13.5px] text-tinta md:inline">
                    {resumo.aulas} {resumo.aulas === 1 ? 'aula' : rotuloSessoes}
                  </span>
                  {/* a barra é a ocupação: lotada em vermelho, como na legenda da
                      semana, para achar onde não cabe mais ninguém sem abrir o dia */}
                  <span aria-hidden className="h-1.5 overflow-hidden rounded-full bg-linha-fina">
                    <span
                      className={`block h-full rounded-full ${pct >= 100 ? 'bg-alerta' : 'bg-marca'}`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </span>
                </span>
              ) : fechado ? (
                <span className="mt-auto hidden text-[12px] text-tinta-fraca md:inline">Fechado</span>
              ) : null}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
