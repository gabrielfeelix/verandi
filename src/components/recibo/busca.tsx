'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

/**
 * A busca do arquivo: por número ou por nome de quem pagou.
 *
 * Filtra enquanto se digita, como a lista de pessoas e a do financeiro. Quem
 * procura recibo tem o número na mão, escrito no papel, ou o nome na cabeça, e
 * digita um dos dois sem pensar em qual campo é qual.
 */
export function BuscaDeRecibo({
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
      const b = new URLSearchParams({ aba })
      if (texto.trim()) b.set('q', texto.trim())
      iniciar(() => router.replace(`/recibos?${b}`, { scroll: false }))
    }, 250)
    return () => clearTimeout(t)
  }, [texto, valorInicial, aba, router])

  return (
    <form className="relative flex items-center" onSubmit={(e) => e.preventDefault()}>
      <label htmlFor="rec-busca" className="sr-only">
        Procurar por número ou por nome
      </label>
      <input
        id="rec-busca"
        name="q"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Procurar pelo número ou pelo nome de quem pagou"
        className="campo"
        autoComplete="off"
      />
      {pendente ? (
        <span className="absolute right-3 text-[11.5px] text-tinta-fraca">procurando</span>
      ) : null}
    </form>
  )
}
