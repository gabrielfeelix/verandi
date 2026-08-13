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
        <p className="opacity-70">Sem horário fixo.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {ativas.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center gap-2 rounded border p-2">
              <span>{v.rotulo}</span>
              <span className="text-sm opacity-70">desde {v.desde}</span>
              <button
                type="button"
                disabled={pendente}
                className="ml-auto text-sm underline"
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
          <summary className="cursor-pointer text-sm opacity-70">
            {encerradas.length} encerrada(s)
          </summary>
          <ul className="mt-2 flex flex-col gap-1 text-sm opacity-70">
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
          <label htmlFor="serie">Nova {rotuloVaga.toLowerCase()}</label>
          <select id="serie" name="serie" required className="rounded border px-2 py-2">
            <option value="">escolha o horário</option>
            {series.map((s) => (
              <option key={s.id} value={s.id}>{s.rotulo}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="desde">A partir de</label>
          <input id="desde" name="desde" type="date" defaultValue={hoje}
                 className="rounded border px-2 py-2" />
        </div>

        <button type="submit" disabled={pendente} className="rounded border px-3 py-2">
          Adicionar
        </button>
      </form>

      <p className="text-sm opacity-60">
        Ocupa esse horário toda semana, por tempo indeterminado.
      </p>
    </div>
  )
}
