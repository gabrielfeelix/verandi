'use client'

import { useTransition } from 'react'
import { criarVaga, encerrarVaga } from '@/server/pessoas/acoes'

type Props = {
  pessoaId: string
  vagas: Array<{ id: string; rotulo: string; desde: string; ate: string | null }>
  series: Array<{ id: string; rotulo: string }>
  rotuloVaga: string
}

export function Vagas({ pessoaId, vagas, series, rotuloVaga }: Props) {
  const [pendente, iniciar] = useTransition()
  const hoje = new Date().toISOString().slice(0, 10)

  const ativas = vagas.filter((v) => v.ate === null || v.ate >= hoje)
  const encerradas = vagas.filter((v) => v.ate !== null && v.ate < hoje)

  return (
    <div className="flex flex-col gap-3">
      {ativas.length === 0 ? (
        <p className="text-[12.5px] text-tinta-media">
          Sem horário fixo. Quem só vem de vez em quando é normal — a vaga
          recorrente é para quem ocupa o mesmo horário toda semana.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {ativas.map((v) => (
            <li
              key={v.id}
              className="flex flex-wrap items-center gap-2.5 rounded-[12px] border border-linha-suave bg-superficie-suave px-3 py-2.5"
            >
              <span className="text-[13.5px] font-medium">{v.rotulo}</span>
              <span className="font-mono text-[11.5px] text-tinta-media">
                desde {v.desde.slice(8)}/{v.desde.slice(5, 7)}/{v.desde.slice(2, 4)}
              </span>
              <button
                type="button"
                disabled={pendente}
                className="ml-auto min-h-9 rounded-[10px] border border-linha-suave bg-superficie px-3 text-[12.5px] text-tinta-media hover:border-[#F0D6C8] hover:bg-[#FFF6F1] hover:text-alerta"
                onClick={() => {
                  if (confirm('Encerrar a partir de hoje? O histórico anterior fica.')) {
                    iniciar(() => encerrarVaga(v.id, hoje))
                  }
                }}
              >
                Encerrar
              </button>
            </li>
          ))}
        </ul>
      )}

      {encerradas.length > 0 ? (
        <details>
          <summary className="cursor-pointer text-[12.5px] text-tinta-media">
            {encerradas.length} encerrada(s)
          </summary>
          <ul className="mt-2 flex flex-col gap-1 text-[12.5px] text-tinta-media">
            {encerradas.map((v) => (
              <li key={v.id}>{v.rotulo} — de {v.desde} até {v.ate}</li>
            ))}
          </ul>
        </details>
      ) : null}

      <form
        className="flex flex-wrap items-end gap-2"
        action={(f) => {
          const serieId = String(f.get('serie') ?? '')
          if (!serieId) return
          iniciar(() => criarVaga(serieId, pessoaId, String(f.get('desde') ?? hoje)))
        }}
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="serie" className="text-[12.5px] font-medium">
            Nova {rotuloVaga.toLowerCase()}
          </label>
          <select id="serie" name="serie" required className="min-h-11 rounded-[11px] border border-linha bg-superficie px-2.5 text-[13px]">
            <option value="">escolha o horário</option>
            {series.map((s) => (
              <option key={s.id} value={s.id}>{s.rotulo}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="desde" className="text-[12.5px] font-medium">A partir de</label>
          <input id="desde" name="desde" type="date" defaultValue={hoje}
                 className="min-h-11 rounded-[11px] border border-linha bg-superficie px-2.5 text-[13px]" />
        </div>

        <button type="submit" disabled={pendente} className="min-h-11 rounded-[11px] border border-linha bg-superficie px-3 text-[13px]">
          Adicionar
        </button>
      </form>

      <p className="text-[11.5px] text-tinta-media">
        Ocupa esse horário toda semana, por tempo indeterminado.
      </p>
    </div>
  )
}
