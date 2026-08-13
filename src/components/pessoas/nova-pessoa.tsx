'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { criarPessoa } from '@/server/pessoas/acoes'

/**
 * Cadastro com **nome apenas** como mínimo. Exigir telefone é o jeito mais
 * rápido de fazer a recepção inventar um número.
 */
export function NovaPessoa({
  rotuloPessoa, aoCriar,
}: {
  rotuloPessoa: string
  aoCriar?: (id: string) => void
}) {
  const [aberto, setAberto] = useState(false)
  const [pendente, iniciar] = useTransition()
  const router = useRouter()

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="self-start rounded border px-3 py-2"
      >
        Cadastrar {rotuloPessoa.toLowerCase()}
      </button>
    )
  }

  return (
    <form
      className="flex flex-wrap items-end gap-2 rounded border p-3"
      action={(f) => {
        const nome = String(f.get('nome') ?? '')
        const telefone = String(f.get('telefone') ?? '')
        iniciar(async () => {
          const { id } = await criarPessoa({ nome, telefone })
          setAberto(false)
          if (aoCriar) aoCriar(id)
          else router.push(`/pessoas/${id}`)
        })
      }}
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="nome">Nome</label>
        <input id="nome" name="nome" required className="rounded border px-3 py-2" />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="telefone">Telefone (opcional)</label>
        <input id="telefone" name="telefone" className="rounded border px-3 py-2" />
      </div>

      <button type="submit" disabled={pendente} className="rounded border px-3 py-2">
        Salvar
      </button>
      <button type="button" onClick={() => setAberto(false)} className="px-2 py-2 underline">
        Cancelar
      </button>
    </form>
  )
}
