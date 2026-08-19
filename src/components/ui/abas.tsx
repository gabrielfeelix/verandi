import Link from 'next/link'
import type { ReactNode } from 'react'

export type Aba = {
  id: string
  rotulo: ReactNode
  /** número ao lado do rótulo; `undefined` não desenha nada */
  contagem?: number
  /** quando existe, a aba é um link de verdade e o estado mora na URL */
  href?: string
}

/**
 * O trilho segmentado do design system: um grupo pequeno de opções onde só uma
 * vale por vez.
 *
 * Para duas a cinco opções curtas isto substitui `<select>`. O menu suspenso
 * esconde as alternativas atrás de um clique e, num toque, cobre metade da tela
 * com uma lista do sistema — aqui as opções já estão à vista e o alvo é o dobro.
 */
export function Abas({
  itens,
  ativo,
  aoTrocar,
  rotuloDoGrupo,
  className = '',
}: {
  itens: Aba[]
  ativo: string
  aoTrocar?: (id: string) => void
  /** o que este grupo escolhe — lido por leitor de tela antes das opções */
  rotuloDoGrupo: string
  className?: string
}) {
  return (
    <div
      role={aoTrocar ? 'tablist' : undefined}
      aria-label={rotuloDoGrupo}
      /*
       * `max-w-full` + rolagem própria: quatro abas com `whitespace-nowrap`
       * dão 383px, e num celular de 390px isso empurrava a página inteira para
       * o lado. Quem rola é a fita de abas, nunca a tela.
       */
      className={`inline-flex max-w-full gap-[3px] overflow-x-auto rounded-media border border-linha bg-superficie p-1 ${className}`}
    >
      {itens.map((i) => {
        const ligado = i.id === ativo
        /*
         * O hover do ativo continua escuro. Clarear o ativo ao passar o mouse
         * faz parecer que ele desligou — o feedback contradiz o estado.
         */
        const estilo = `inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-padrao px-3 text-[14px] whitespace-nowrap transition-colors duration-150 ${
          ligado
            ? 'bg-escuro font-medium text-tinta-clara'
            : 'text-tinta-media hover:bg-superficie-mais-suave'
        }`

        const dentro = (
          <>
            {i.rotulo}
            {i.contagem === undefined ? null : (
              <span
                className={`rounded-minima px-1.5 font-mono text-[12px] ${
                  ligado ? 'bg-tinta-clara/16 text-tinta-clara' : 'bg-superficie-mais-suave text-tinta-media'
                }`}
              >
                {i.contagem}
              </span>
            )}
          </>
        )

        return i.href ? (
          <Link
            key={i.id}
            href={i.href}
            aria-current={ligado ? 'page' : undefined}
            className={estilo}
          >
            {dentro}
          </Link>
        ) : (
          <button
            key={i.id}
            type="button"
            role="tab"
            aria-selected={ligado}
            onClick={() => aoTrocar?.(i.id)}
            className={estilo}
          >
            {dentro}
          </button>
        )
      })}
    </div>
  )
}
