'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

/**
 * A busca de Buscar vaga, que filtra enquanto se digita.
 *
 * O mesmo trato da busca de Alunos: `?q=` na URL, respiro de 250ms, `replace`
 * para o histórico não guardar uma letra por entrada. A diferença é que aqui os
 * chips são vários parâmetros soltos, e buscar não pode limpar nenhum deles:
 * o endereço atual é copiado inteiro e só o `q` muda.
 */
export function BuscaDeVaga({ valorInicial }: { valorInicial: string }) {
  const [texto, setTexto] = useState(valorInicial)
  const [pendente, iniciar] = useTransition()
  const router = useRouter()
  const caminho = usePathname()
  const params = useSearchParams()
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
      const busca = new URLSearchParams(params.toString())
      if (texto.trim()) busca.set('q', texto.trim())
      else busca.delete('q')
      const s = busca.toString()
      iniciar(() => router.replace(s ? `${caminho}?${s}` : caminho, { scroll: false }))
    }, 250)
    return () => clearTimeout(t)
  }, [texto, valorInicial, caminho, router, params])

  return (
    <form className="relative flex items-center" onSubmit={(e) => e.preventDefault()}>
      <span
        aria-hidden
        className={`pointer-events-none absolute left-3.5 font-mono text-[14px] ${
          pendente ? 'text-marca' : 'text-tinta-fraca'
        }`}
      >
        ⌕
      </span>
      <input
        name="q" value={texto} aria-label="Buscar horário"
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Exemplo: terça 18h aparelho"
        className="min-h-11 w-full rounded-padrao border border-linha bg-superficie pr-3.5 pl-9 text-[14px] placeholder:text-tinta-fraca"
      />
    </form>
  )
}
