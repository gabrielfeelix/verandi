import type { SerieLinha } from '@/server/grade/consultas'
import { cartao } from '@/components/ui/pecas'

/*
 * Serviço não tem cor no banco — e não deve ter: cor de gráfico é decisão de
 * tela, e uma coluna `servico.cor` viraria mais um campo para a conta preencher
 * sem que nada dependesse dele. A ordem alfabética dá a mesma cor sempre.
 */
const CORES = ['#0E7C6B', '#F0693C', '#4A5C8C', '#5B4C7C', '#4E6B37', '#8A6A22']

/**
 * Quanto da grade cada serviço ocupa, e quanto dela está cheia.
 *
 * A tela de grade responde "que horários existem"; esta coluna responde a
 * pergunta que vem logo depois e que a lista não responde: **onde sobra vaga**.
 * Pilates a 82% e Boxe a 61% é a diferença entre abrir turma nova e cancelar
 * uma.
 */
export function CapacidadeDaSemana({
  series, rotuloSeries,
}: {
  series: SerieLinha[]
  rotuloSeries: string
}) {
  const porServico = new Map<string, { n: number; ocupadas: number; vagas: number }>()
  for (const s of series) {
    const atual = porServico.get(s.servico) ?? { n: 0, ocupadas: 0, vagas: 0 }
    porServico.set(s.servico, {
      n: atual.n + 1,
      ocupadas: atual.ocupadas + s.ocupadas,
      vagas: atual.vagas + s.capacidade,
    })
  }

  const linhas = [...porServico.entries()]
    .map(([servico, v]) => ({
      servico,
      ...v,
      pct: v.vagas === 0 ? 0 : Math.round((v.ocupadas / v.vagas) * 100),
    }))
    .sort((a, b) => b.n - a.n || a.servico.localeCompare(b.servico, 'pt-BR'))

  if (linhas.length === 0) return null

  return (
    <section className={`${cartao} p-4`}>
      <h2 className="pb-3 font-titulo text-[17px] font-semibold">
        Capacidade da semana
      </h2>
      <ul className="flex flex-col gap-3.5">
        {linhas.map((l, i) => (
          <li key={l.servico} className="flex flex-col gap-1.5">
            <span className="flex items-baseline justify-between gap-3">
              <span className="truncate text-[13px] font-medium">{l.servico}</span>
              <span className="shrink-0 font-mono text-[11.5px] text-tinta-media">
                {l.n} {l.n === 1 ? rotuloSeries.replace(/s$/, '') : rotuloSeries} · {l.pct}%
              </span>
            </span>
            {/* a barra é o resumo; o número ao lado é o dado. Barra sozinha em
                cinza claro some, e número sozinho não deixa comparar de relance */}
            <span
              aria-hidden
              className="h-1.5 overflow-hidden rounded-full bg-superficie-mais-suave"
            >
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${Math.min(100, l.pct)}%`,
                  background: CORES[i % CORES.length],
                }}
              />
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
