'use client'

import { useState, useTransition } from 'react'
import type { Ocupacao } from '@/core/agenda/ocupacao'
import { ajustarCapacidade, cancelarSessao, encaixar } from '@/server/agenda/acoes'

type Candidato = { id: string; nome: string; detalhe: string }

type Props = {
  sessaoId: string
  ocupacao: Ocupacao
  cancelada: boolean
  quantasPessoas: number
  candidatos: Candidato[]
  rotuloPessoa: string
}

export function PainelVaga({
  sessaoId, ocupacao, cancelada, quantasPessoas, candidatos, rotuloPessoa,
}: Props) {
  const [pendente, iniciar] = useTransition()
  const [busca, setBusca] = useState('')
  const [origem, setOrigem] = useState<'avulso' | 'reposicao' | 'encaixe' | 'reserva'>('avulso')
  const [aviso, setAviso] = useState<string | null>(null)

  const normalizar = (s: string) =>
    s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

  const achados = busca.trim().length < 2
    ? []
    : candidatos
        .filter((c) => normalizar(c.nome).includes(normalizar(busca)))
        .slice(0, 8)

  function adicionar(pessoaId: string) {
    setAviso(null)
    iniciar(async () => {
      const r = await encaixar({ sessaoId, pessoaId, origem })
      if (!r.ok) {
        setAviso(
          r.motivo === 'lotada'
            ? 'Este horário está cheio. Para caber mais um, aumente a capacidade abaixo.'
            : `Essa ${rotuloPessoa.toLowerCase()} já está neste horário.`,
        )
      } else {
        setBusca('')
      }
    })
  }

  return (
    <section className="flex flex-col gap-4 rounded border p-3">
      <div>
        <h2 className="font-medium">Vagas</h2>
        <p className={ocupacao.excedida ? 'font-bold' : undefined}>
          {ocupacao.ocupadas}/{ocupacao.capacidade}
          {ocupacao.lotada ? ' — cheio' : ` — ${ocupacao.livres} livre(s)`}
        </p>
      </div>

      {!cancelada ? (
        <div className="flex flex-col gap-2">
          <label htmlFor="busca-pessoa">Colocar alguém neste horário</label>

          <select
            aria-label="Tipo"
            value={origem}
            onChange={(e) => setOrigem(e.target.value as typeof origem)}
            className="rounded border px-2 py-1"
          >
            <option value="avulso">Avulso</option>
            <option value="reposicao">Reposição</option>
            <option value="encaixe">Encaixe</option>
            <option value="reserva">Reserva</option>
          </select>

          <input
            id="busca-pessoa"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome"
            className="rounded border px-3 py-2"
          />

          {achados.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {achados.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    disabled={pendente}
                    onClick={() => adicionar(c.id)}
                    className="w-full rounded border px-3 py-2 text-left"
                  >
                    {c.nome}
                    <span className="ml-2 text-sm opacity-60">{c.detalhe}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {aviso ? <p role="alert">{aviso}</p> : null}
        </div>
      ) : null}

      <form
        action={(f) => {
          const n = Number(f.get('capacidade'))
          iniciar(async () => {
            await ajustarCapacidade(sessaoId, n)
            setAviso(null)
          })
        }}
        className="flex items-end gap-2"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="capacidade">Capacidade só deste dia</label>
          <input
            id="capacidade" name="capacidade" type="number" min={1}
            defaultValue={ocupacao.capacidade}
            className="w-24 rounded border px-2 py-1"
          />
        </div>
        <button type="submit" disabled={pendente} className="rounded border px-3 py-1">
          Salvar
        </button>
      </form>
      <p className="text-sm opacity-60">
        Muda só este horário. A grade fixa das outras semanas continua igual.
      </p>

      {!cancelada ? (
        <form
          action={(f) => {
            const motivo = String(f.get('motivo') ?? '').trim()
            if (!motivo) return
            const quantos = quantasPessoas
            if (!confirm(`Cancelar este horário? ${quantos} pessoa(s) serão avisadas.`)) return
            iniciar(() => cancelarSessao(sessaoId, motivo))
          }}
          className="flex items-end gap-2 border-t pt-3"
        >
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="motivo">Cancelar este horário</label>
            <input
              id="motivo" name="motivo" required placeholder="Motivo"
              className="rounded border px-2 py-1"
            />
          </div>
          <button type="submit" disabled={pendente} className="rounded border px-3 py-1">
            Cancelar horário
          </button>
        </form>
      ) : null}
    </section>
  )
}
