import Link from 'next/link'
import type { SessaoResumo } from '@/server/agenda/consultas'
import { CelulaTurma } from './grade-semana'

export type Recurso = { id: string; nome: string; cor?: string | null }

/**
 * O dia inteiro, uma coluna por recurso: sala ou profissional.
 *
 * Quem tem sete salas não pergunta "como está a semana", pergunta "como está
 * hoje, sala por sala". Na grade semanal essas sete turmas paralelas viram uma
 * célula empilhada e ilegível; aqui cada uma tem a sua coluna.
 */
export function DiaPorRecurso({
  sessoes, recursos, eixo, chaveDe, vazio,
}: {
  sessoes: SessaoResumo[]
  recursos: Recurso[]
  /** o que está nas colunas, para o cabeçalho dizer */
  eixo: string
  /** de qual recurso é esta sessão */
  chaveDe: (s: SessaoResumo) => string | null
  vazio: string
}) {
  const horas = [...new Set(sessoes.map((s) => s.hora))].sort()

  // o que não tem recurso definido não some: ganha uma coluna própria no fim
  const semRecurso = sessoes.filter((s) => chaveDe(s) === null)
  const colunas: Recurso[] = semRecurso.length
    ? [...recursos, { id: '', nome: `sem ${eixo.toLowerCase()}` }]
    : recursos

  if (horas.length === 0 || colunas.length === 0) {
    return (
      <section className="rounded-[20px] border border-dashed border-[#C6D2CD] bg-superficie px-6 py-8 text-center">
        <p className="text-[13px] text-tinta-media">{vazio}</p>
      </section>
    )
  }

  const porCelula = new Map<string, SessaoResumo[]>()
  for (const s of sessoes) {
    const k = `${chaveDe(s) ?? ''}|${s.hora}`
    porCelula.set(k, [...(porCelula.get(k) ?? []), s])
  }

  return (
    <section
      aria-label="Dia por recurso"
      className="max-h-[calc(100vh-210px)] overflow-auto rounded-[20px] border border-linha bg-superficie p-3.5"
    >
      <div
        className="grid gap-1.5"
        style={{
          minWidth: 180 + colunas.length * 150,
          gridTemplateColumns: `58px repeat(${colunas.length}, minmax(140px,1fr))`,
        }}
      >
        <div className="sticky top-0 z-3 bg-superficie" />
        {colunas.map((r) => (
          <div
            key={r.id}
            className="sticky top-0 z-3 flex flex-col items-center gap-0.5 rounded-[10px] bg-superficie px-2 pt-1.5 pb-2.5 shadow-[0_6px_0_#fff]"
          >
            <span className="flex items-center gap-1.5">
              {r.cor ? (
                <span
                  aria-hidden
                  className="size-2 rounded-full"
                  style={{ background: r.cor }}
                />
              ) : null}
              <span className="truncate text-[12.5px] font-medium">{r.nome}</span>
            </span>
            <span className="font-mono text-[10.5px] text-tinta-media">
              {sessoes.filter((s) => (chaveDe(s) ?? '') === r.id).length} no dia
            </span>
          </div>
        ))}

        {horas.map((hora) => (
          <div key={hora} className="contents">
            <div className="flex items-start justify-end pt-1.5 pr-2">
              <span className="font-mono text-[12px] text-tinta-media">{hora}</span>
            </div>

            {colunas.map((r) => {
              const celula = porCelula.get(`${r.id}|${hora}`) ?? []
              if (celula.length === 0) {
                return (
                  <div
                    key={r.id}
                    className="flex min-h-14 items-center justify-center rounded-[12px] border border-[#F1F5F3] bg-[#FBFCFB] font-mono text-[13px] text-[#C6D2CD]"
                  >
                    <span aria-hidden>+</span>
                  </div>
                )
              }
              return (
                <div
                  key={r.id}
                  className="flex min-h-14 flex-col gap-1.5 rounded-[12px] border border-linha-suave bg-superficie p-1"
                >
                  {celula.map((s) => (
                    <CelulaTurma key={s.id} sessao={s} />
                  ))}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </section>
  )
}

/** O par de botões Semana | Dia, que troca o modo pela URL. */
export function AlternarModo({
  semana, dia, ehDia,
}: {
  semana: string
  dia: string
  ehDia: boolean
}) {
  return (
    <div className="flex gap-[3px] rounded-[12px] border border-linha bg-superficie p-[3px]">
      <Link
        href={semana}
        aria-current={ehDia ? undefined : 'page'}
        className={`rounded-[9px] px-3 py-2 text-[13px] font-medium ${
          ehDia ? 'text-tinta-media' : 'bg-escuro text-tinta-clara'
        }`}
      >
        Semana
      </Link>
      <Link
        href={dia}
        aria-current={ehDia ? 'page' : undefined}
        className={`rounded-[9px] px-3 py-2 text-[13px] font-medium ${
          ehDia ? 'bg-escuro text-tinta-clara' : 'text-tinta-media'
        }`}
      >
        Dia por recurso
      </Link>
    </div>
  )
}
