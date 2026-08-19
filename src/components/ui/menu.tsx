'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Icone, type NomeIcone } from './icones'

export type ItemMenu = {
  rotulo: string
  icone?: NomeIcone
  aoEscolher: () => void
  /** ação destrutiva: vermelha, e o design system manda pôr por último */
  perigo?: boolean
}

/**
 * O menu de três pontinhos.
 *
 * Guarda o que **não é "foi ou não foi"**: editar, remover, transferir. O que a
 * pessoa faz o tempo todo fica à vista na linha; o resto mora aqui, senão cada
 * linha da lista vira uma barra de ferramentas.
 *
 * Fecha ao clicar fora, ao apertar `Esc` e ao escolher — e devolve o foco ao
 * gatilho, porque quem navega por teclado não tem para onde voltar sozinho.
 */
export function Menu({ titulo, itens }: { titulo: string; itens: ItemMenu[] }) {
  const [aberto, setAberto] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)
  const gatilho = useRef<HTMLButtonElement>(null)
  const id = useId()

  useEffect(() => {
    if (!aberto) return

    const foraDaCaixa = (e: MouseEvent) => {
      if (!caixa.current?.contains(e.target as Node)) setAberto(false)
    }
    const escapou = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setAberto(false)
      gatilho.current?.focus()
    }

    document.addEventListener('mousedown', foraDaCaixa)
    document.addEventListener('keydown', escapou)
    return () => {
      document.removeEventListener('mousedown', foraDaCaixa)
      document.removeEventListener('keydown', escapou)
    }
  }, [aberto])

  return (
    <div ref={caixa} className="relative">
      <button
        ref={gatilho}
        type="button"
        title={titulo}
        aria-label={titulo}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={aberto ? id : undefined}
        onClick={() => setAberto((v) => !v)}
        className="inline-flex size-11 cursor-pointer items-center justify-center rounded-peca text-tinta-media transition-colors duration-150 hover:bg-superficie-mais-suave hover:text-tinta md:size-[34px]"
      >
        <Icone nome="kebab" />
      </button>

      {aberto ? (
        <div
          id={id}
          role="menu"
          aria-label={titulo}
          className="absolute top-[38px] right-0 z-[25] flex w-[216px] flex-col gap-0.5 rounded-grande border border-linha-suave bg-superficie p-1.5 shadow-elevado"
          style={{ animation: 'vd-pop .18s ease both' }}
        >
          {itens.map((i) => (
            <button
              key={i.rotulo}
              type="button"
              role="menuitem"
              onClick={() => {
                setAberto(false)
                i.aoEscolher()
              }}
              className={`flex min-h-10 cursor-pointer items-center gap-2.5 rounded-peca px-2.5 text-left text-[14px] transition-colors duration-150 hover:bg-superficie-suave ${
                i.perigo ? 'text-alerta' : 'text-tinta'
              }`}
            >
              {i.icone ? <Icone nome={i.icone} tamanho={16} /> : null}
              {i.rotulo}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
