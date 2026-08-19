'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { buscarCandidatos } from '@/server/agenda/acoes'
import { Avatar } from '@/components/ui/pecas'

type Achado = { id: string; nome: string; detalhe: string }

/**
 * Achar uma pessoa sem sair do Hoje.
 *
 * Este lugar já existia na tela, e era um `<span>`: parecia um campo de busca,
 * tinha o `/` do atalho desenhado ao lado, e não aceitava foco nem digitação. O
 * design system é explícito — "tudo que parece clicável tem destino" —, e uma
 * caixa de busca falsa é a pior versão disso, porque a recepção tenta usar
 * justamente quando está com alguém na frente esperando.
 *
 * Busca pelo mesmo caminho do encaixe (`buscarCandidatos`): nome sem acento,
 * telefone ou identificador, a partir de duas letras.
 */
export function BuscaRapida({ rotuloPessoa }: { rotuloPessoa: string }) {
  const [texto, setTexto] = useState('')
  const [achados, setAchados] = useState<Achado[]>([])
  const [buscando, setBuscando] = useState(false)
  const [foco, setFoco] = useState(-1)
  const campo = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const idLista = useId()

  const curto = texto.trim().length < 2
  // o que aparece é derivado do texto: com menos de duas letras não há lista,
  // sem precisar de um setState dentro do efeito só para esvaziá-la
  const lista = curto ? [] : achados

  useEffect(() => {
    const busca = texto.trim()
    if (busca.length < 2) return
    let cancelado = false
    const t = setTimeout(async () => {
      // marcado aqui dentro, e não no corpo do efeito: assim a lista de "nada
      // encontrado" não pisca entre uma tecla e outra, e nenhum setState roda
      // de forma síncrona dentro do efeito
      setBuscando(true)
      try {
        const r = await buscarCandidatos(busca)
        if (!cancelado) { setAchados(r); setFoco(-1) }
      } finally {
        if (!cancelado) setBuscando(false)
      }
    }, 200)
    return () => { cancelado = true; clearTimeout(t) }
  }, [texto])

  // `/` foca a busca de qualquer lugar da tela, que é o atalho que o desenho
  // sempre prometeu ao mostrar a tecla dentro do campo
  useEffect(() => {
    function atalho(e: KeyboardEvent) {
      if (e.key !== '/' || e.metaKey || e.ctrlKey) return
      const alvo = e.target as HTMLElement | null
      const digitando = alvo instanceof HTMLInputElement
        || alvo instanceof HTMLTextAreaElement
        || alvo?.isContentEditable
      if (digitando) return
      e.preventDefault()
      campo.current?.focus()
    }
    document.addEventListener('keydown', atalho)
    return () => document.removeEventListener('keydown', atalho)
  }, [])

  function abrir(id: string) {
    setTexto('')
    setAchados([])
    router.push(`/pessoas/${id}`)
  }

  const aberto = lista.length > 0 || (!curto && !buscando)

  return (
    <div className="relative hidden lg:block">
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 font-mono text-[13px] text-tinta-fraca"
      >
        /
      </span>
      <input
        ref={campo}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { setTexto(''); campo.current?.blur() }
          if (!lista.length) return
          if (e.key === 'ArrowDown') { e.preventDefault(); setFoco((i) => (i + 1) % lista.length) }
          if (e.key === 'ArrowUp') { e.preventDefault(); setFoco((i) => (i <= 0 ? lista.length : i) - 1) }
          if (e.key === 'Enter') { e.preventDefault(); abrir(lista[foco < 0 ? 0 : foco].id) }
        }}
        role="combobox"
        aria-expanded={aberto}
        aria-controls={idLista}
        aria-label={`Buscar ${rotuloPessoa.toLowerCase()}`}
        placeholder={`Buscar ${rotuloPessoa.toLowerCase()}`}
        className="min-h-11 w-[240px] rounded-padrao border border-linha bg-superficie pr-3.5 pl-8 text-[14px] placeholder:text-tinta-fraca"
      />

      {aberto ? (
        <ul
          id={idLista}
          role="listbox"
          className="absolute top-[calc(100%+6px)] right-0 z-40 max-h-[320px] w-[300px] overflow-y-auto rounded-grande border border-linha bg-superficie p-1.5 shadow-modal"
        >
          {lista.length === 0 ? (
            <li className="px-3 py-2.5 text-[13.5px] text-tinta-media">
              Ninguém com esse nome, telefone ou identificador.
            </li>
          ) : (
            lista.map((a, i) => (
              <li key={a.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === foco}
                  onMouseEnter={() => setFoco(i)}
                  onClick={() => abrir(a.id)}
                  className={`flex w-full items-center gap-2.5 rounded-padrao px-2.5 py-2 text-left ${
                    i === foco ? 'bg-superficie-suave' : ''
                  }`}
                >
                  <Avatar nome={a.nome} />
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="truncate text-[14.5px] font-medium">{a.nome}</span>
                    <span className="text-[12.5px] text-tinta-fraca">{a.detalhe}</span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}
