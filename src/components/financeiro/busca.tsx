'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

/**
 * A busca por nome, que filtra enquanto se digita.
 *
 * Mesma decisão da lista de pessoas: o `Enter` sozinho fazia quem digitava
 * concluir que a busca não funcionava. O endereço continua sendo a verdade, e
 * o `replace` evita uma entrada de histórico por letra.
 */
export function BuscaDeCobranca({
  valorInicial, aba,
}: {
  valorInicial: string
  aba: string
}) {
  const [texto, setTexto] = useState(valorInicial)
  const [pendente, iniciar] = useTransition()
  const router = useRouter()
  const primeira = useRef(true)

  const [ultimaUrl, setUltimaUrl] = useState(valorInicial)
  if (valorInicial !== ultimaUrl) {
    setUltimaUrl(valorInicial)
    setTexto(valorInicial)
  }

  useEffect(() => {
    if (primeira.current) { primeira.current = false; return }
    if (texto === valorInicial) return
    const t = setTimeout(() => {
      const busca = new URLSearchParams({ aba })
      if (texto.trim()) busca.set('q', texto.trim())
      iniciar(() => router.replace(`/financeiro?${busca}`, { scroll: false }))
    }, 250)
    return () => clearTimeout(t)
  }, [texto, valorInicial, aba, router])

  return (
    <form className="relative flex items-center" onSubmit={(e) => e.preventDefault()}>
      <label htmlFor="fin-busca" className="sr-only">Procurar por nome</label>
      <input
        id="fin-busca"
        name="q"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Procurar por nome"
        className="campo"
        autoComplete="off"
      />
      {pendente ? (
        <span className="absolute right-3 text-[11.5px] text-tinta-fraca">procurando</span>
      ) : null}
    </form>
  )
}
