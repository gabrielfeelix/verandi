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
        className="min-h-11 rounded-padrao bg-escuro px-3.5 text-[13px] font-medium text-tinta-clara hover:bg-escuro-hover"
      >
        Cadastrar {rotuloPessoa.toLowerCase()}
      </button>
    )
  }

  return (
    <form
      className="flex flex-wrap items-end gap-2 rounded-grande border border-linha-suave bg-superficie-suave p-3"
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
        <label htmlFor="nome" className="text-[12.5px] font-medium">Nome</label>
        <input
          id="nome" name="nome" required autoFocus
          className="min-h-11 rounded-padrao border border-linha bg-superficie px-3 text-[13px]"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="telefone" className="text-[12.5px] font-medium">
          Telefone (opcional)
        </label>
        <input
          id="telefone" name="telefone"
          className="min-h-11 rounded-padrao border border-linha bg-superficie px-3 text-[13px]"
        />
      </div>

      <button
        type="submit" disabled={pendente}
        className="min-h-11 rounded-padrao bg-escuro px-4 text-[13px] font-medium text-tinta-clara disabled:opacity-60"
      >
        Salvar
      </button>
      <button
        type="button" onClick={() => setAberto(false)}
        className="min-h-11 px-2 text-[12.5px] text-tinta-media underline"
      >
        Cancelar
      </button>
    </form>
  )
}
