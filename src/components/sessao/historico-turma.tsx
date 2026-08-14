import type { EventoDaTurma } from '@/server/agenda/consultas'
import { cartao } from '@/components/ui/pecas'

const PONTO = {
  positivo: 'bg-positivo',
  atencao: 'bg-atencao',
  alerta: 'bg-alerta',
  info: 'bg-info',
  neutro: 'bg-linha-tracejada',
} as const

/**
 * Como esta turma ficou do jeito que está.
 *
 * Não é auditoria — é a resposta para "quem não estava aqui semana passada?".
 * Sai do que o banco já guarda (`participacao.registrado_em` e a série que
 * criou a sessão); por isso a última linha é sempre a criação da turma, e não
 * existe linha para mudança de presença, que hoje não deixa data.
 */
export function HistoricoDaTurma({ eventos }: { eventos: EventoDaTurma[] }) {
  if (eventos.length === 0) return null

  return (
    <section className={`${cartao} p-4`}>
      <h2 className="pb-3 font-titulo text-[17px] font-semibold">Histórico da turma</h2>
      <ol className="flex flex-col">
        {eventos.map((e, i) => (
          <li key={`${e.quando}-${e.texto}`} className="flex gap-3">
            <span aria-hidden className="flex flex-col items-center pt-[5px]">
              <span className={`size-[7px] shrink-0 rounded-full ${PONTO[e.tom]}`} />
              {/* a linha só liga um ponto ao próximo; no último ela seria um
                  risco pendurado no nada */}
              {i < eventos.length - 1 ? (
                <span className="min-h-[22px] w-px flex-1 bg-linha-suave" />
              ) : null}
            </span>
            <span
              className={`flex flex-col leading-[1.35] ${
                i < eventos.length - 1 ? 'pb-3.5' : ''
              }`}
            >
              <span className="text-[13px]">{e.texto}</span>
              <span className="text-[11.5px] text-tinta-media">{e.quando}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}
