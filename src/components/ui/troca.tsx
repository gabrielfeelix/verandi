'use client'

import { useRouter } from 'next/navigation'
import {
  createContext, useCallback, useContext, useMemo, useState, useTransition,
  type MouseEvent, type ReactNode,
} from 'react'

/**
 * A troca de tela que acontece no primeiro quadro depois do clique.
 *
 * O problema que isto resolve é do App Router e não do banco: mudar só o
 * `searchParams` do mesmo segmento **não atravessa `loading.tsx`**. O Next
 * mantém a tela antiga inteira montada até o servidor responder, e a pessoa
 * fica olhando para o dado velho com a interface respondendo normalmente. Quem
 * clica não conclui "está carregando", conclui que o botão não funciona.
 *
 * A saída é assumir a transição: `router.push` dentro de `useTransition` dá o
 * `pendente`, e com ele a área de conteúdo troca para o esqueleto **na hora**,
 * enquanto a resposta vem. O esqueleto é o mesmo `loading.tsx` da rota, então a
 * forma da tela já está certa antes do dado chegar.
 *
 * Não serve para troca de rota de verdade: essa o `loading.tsx` já cobre
 * sozinho.
 */
type Troca = {
  /** verdadeiro entre o clique e a resposta do servidor */
  pendente: boolean
  /** para onde estamos indo, para o controle clicado já parecer escolhido */
  alvo: string | null
  ir: (href: string) => void
}

const Contexto = createContext<Troca | null>(null)

export function ProvedorDeTroca({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [alvo, setAlvo] = useState<string | null>(null)

  const ir = useCallback((href: string) => {
    setAlvo(href)
    iniciar(() => router.push(href))
  }, [router])

  /* `alvo` só vale enquanto a ida está em pé: parado, quem manda é a URL */
  const valor = useMemo(
    () => ({ pendente, alvo: pendente ? alvo : null, ir }),
    [pendente, alvo, ir],
  )

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useTroca(): Troca | null {
  return useContext(Contexto)
}

/**
 * Verdadeiro quando o clique deve virar navegação nossa.
 *
 * Ctrl, Cmd, Shift, botão do meio e afins continuam sendo do navegador: abrir
 * em outra aba é do link, e roubar isso é quebrar o que ninguém pediu.
 */
export function cliqueSimples(e: MouseEvent): boolean {
  return !e.defaultPrevented && e.button === 0
    && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey
}

/**
 * A área que vira esqueleto enquanto a próxima tela não chega.
 *
 * Fica dentro da página, em volta do que depende de `searchParams`. O esqueleto
 * é o `loading.tsx` da própria rota, nunca um giro no meio da tela, que é a
 * mesma espera com outra roupa e ainda por cima sem a forma certa.
 */
export function AreaQueTroca({
  esqueleto, children,
}: {
  esqueleto: ReactNode
  children: ReactNode
}) {
  const troca = useTroca()
  return troca?.pendente ? <>{esqueleto}</> : <>{children}</>
}
