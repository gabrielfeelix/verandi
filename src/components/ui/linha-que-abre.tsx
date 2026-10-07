'use client'

import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'

/**
 * Linha de tabela que abre um endereço ao clique em qualquer ponto dela.
 *
 * O link de verdade continua no nome (teclado, leitor de tela, abrir em nova
 * aba). Esticar o link por cima da linha não serve aqui: a primeira célula é
 * `sticky`, e o link esticado cobriria só ela.
 */
export function LinhaQueAbre({
  href, className, children,
}: {
  href: string
  className?: string
  children: ReactNode
}) {
  const router = useRouter()
  return (
    <tr
      className={`cursor-pointer ${className ?? ''}`}
      onClick={(e) => {
        // clique em link, botão ou texto selecionado é de quem foi clicado
        if ((e.target as HTMLElement).closest('a,button,input,label')) return
        if (window.getSelection()?.toString()) return
        router.push(href)
      }}
    >
      {children}
    </tr>
  )
}
