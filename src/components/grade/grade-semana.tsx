import Link from 'next/link'
import type { SessaoResumo } from '@/server/agenda/consultas'

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

function diaDe(dataIso: string) {
  return new Date(`${dataIso}T12:00:00Z`).getUTCDay()
}

/**
 * A substituta da planilha. Aguenta 70 horários numa semana porque a linha é o
 * horário, não o bloco desenhado — acrescentar horário é acrescentar linha.
 *
 * Em celular sete colunas não cabem; a folha vira um dia por vez. Não é
 * degradação, é a forma correta no tamanho pequeno.
 */
export function GradeSemana({
  sessoes, dias, feriados,
}: {
  sessoes: SessaoResumo[]
  dias: string[]
  feriados: Record<string, string>
}) {
  const horas = [...new Set(sessoes.map((s) => s.hora))].sort()

  const porCelula = new Map<string, SessaoResumo[]>()
  for (const s of sessoes) {
    const k = `${s.data}|${s.hora}`
    porCelula.set(k, [...(porCelula.get(k) ?? []), s])
  }

  if (horas.length === 0) {
    return <p className="opacity-70">Nenhum horário nesta semana.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Grade da semana</caption>
        <thead>
          <tr>
            <th scope="col" className="border p-1 text-left">Hora</th>
            {dias.map((d) => (
              <th key={d} scope="col" className="border p-1 text-left">
                <span>{DIAS[diaDe(d)]} {d.slice(8)}</span>
                {feriados[d] ? (
                  <span className="block text-xs font-normal">{feriados[d]}</span>
                ) : null}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {horas.map((hora) => (
            <tr key={hora}>
              <th scope="row" className="border p-1 text-left font-normal">{hora}</th>

              {dias.map((d) => {
                const celula = porCelula.get(`${d}|${hora}`) ?? []
                return (
                  <td key={d} className="border p-1 align-top">
                    {celula.map((s) => (
                      <Link
                        key={s.id}
                        href={`/sessao/${s.id}`}
                        className="block"
                        data-cheio={s.ocupacao.lotada ? 'sim' : undefined}
                        data-cancelada={s.status === 'cancelada' ? 'sim' : undefined}
                      >
                        <span className={s.status === 'cancelada' ? 'line-through' : ''}>
                          {s.servico}
                        </span>
                        {s.profissional ? (
                          <span className="block opacity-70">{s.profissional}</span>
                        ) : null}
                        <span
                          className={
                            s.ocupacao.excedida ? 'font-bold'
                            : s.ocupacao.lotada ? 'font-medium' : ''
                          }
                        >
                          {s.ocupacao.ocupadas}/{s.ocupacao.capacidade}
                        </span>
                      </Link>
                    ))}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
