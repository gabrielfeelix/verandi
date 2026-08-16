'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

/**
 * A busca da lista, que **filtra enquanto se digita**.
 *
 * Antes ela só acontecia no `Enter`, e nada na tela dizia isso: quem digitava
 * "Ana" via a lista inteira parada e concluía que a busca não funcionava. Era
 * a queixa mais direta de quem usou o sistema pela primeira vez.
 *
 * O endereço continua sendo a verdade — `?q=` entra na URL, o link se manda no
 * chat e o voltar do navegador desfaz a busca. O que mudou é quem escreve o
 * endereço: o teclado, com um respiro de 250ms, em vez do `Enter`. Usa
 * `replace` e não `push` para o histórico não guardar uma entrada por letra.
 *
 * Sem JavaScript o `form` continua valendo, com o `Enter` de sempre.
 */
export function BuscaDePessoas({
  valorInicial, filtros, tag, placeholder,
}: {
  valorInicial: string
  /** os chips ativos viajam junto: buscar não pode limpar o filtro escolhido */
  filtros: string[]
  tag?: string
  placeholder: string
}) {
  const [texto, setTexto] = useState(valorInicial)
  const [pendente, iniciar] = useTransition()
  const router = useRouter()
  const caminho = usePathname()
  const params = useSearchParams()
  const primeira = useRef(true)

  // o valor da URL manda quando ela muda por fora (voltar, chip, link colado).
  // Ajuste durante a renderização, que é o jeito que o React documenta para
  // estado derivado de prop; num efeito isso custaria uma renderização a mais.
  const [ultimaUrl, setUltimaUrl] = useState(valorInicial)
  if (valorInicial !== ultimaUrl) {
    setUltimaUrl(valorInicial)
    setTexto(valorInicial)
  }

  useEffect(() => {
    if (primeira.current) { primeira.current = false; return }
    if (texto === valorInicial) return
    const t = setTimeout(() => {
      const busca = new URLSearchParams()
      for (const f of filtros) busca.append('f', f)
      if (tag) busca.set('t', tag)
      if (texto.trim()) busca.set('q', texto.trim())
      iniciar(() => router.replace(`${caminho}?${busca}`, { scroll: false }))
    }, 250)
    return () => clearTimeout(t)
  }, [texto, valorInicial, filtros, tag, caminho, router, params])

  return (
    <form className="relative flex items-center" onSubmit={(e) => e.preventDefault()}>
      {filtros.map((x) => <input key={x} type="hidden" name="f" value={x} />)}
      {tag ? <input type="hidden" name="t" value={tag} /> : null}
      <span
        aria-hidden
        className={`pointer-events-none absolute left-3.5 font-mono text-[13px] ${
          pendente ? 'text-marca' : 'text-tinta-fraca'
        }`}
      >
        ⌕
      </span>
      <input
        id="q" name="q" value={texto} aria-label="Buscar"
        onChange={(e) => setTexto(e.target.value)}
        placeholder={placeholder}
        className="min-h-11 min-w-[248px] rounded-padrao border border-linha bg-superficie pr-3.5 pl-9 text-[13px] placeholder:text-tinta-fraca"
      />
      <button type="submit" className="sr-only focus:not-sr-only focus:ml-2">
        Buscar
      </button>
    </form>
  )
}
