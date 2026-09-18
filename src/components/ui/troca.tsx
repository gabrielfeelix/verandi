'use client'

import { useRouter } from 'next/navigation'
import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  useTransition, type MouseEvent, type ReactNode,
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
 * Quanto tempo a espera precisa durar para valer um esqueleto.
 *
 * Abaixo disto o esqueleto **atrapalha**: boa parte das trocas resolve em
 * dezenas de milissegundos, porque o Next já tem a rota no cache do roteador
 * (prefetch do link, voltar, avançar, tela visitada há pouco). Piscar caixa
 * cinza nesses casos é inventar uma espera que não existia, e a tela parece
 * mais lenta do que se nada tivesse aparecido.
 *
 * 160ms é onde as duas coisas se encontram: acima disso a pessoa já percebe a
 * demora e quer sinal; abaixo, a troca chega antes de o olho notar. Quem dá o
 * retorno imediato do clique é o controle, que acende no primeiro quadro sem
 * custar nada.
 */
const ATRASO_DO_ESQUELETO = 160

/**
 * Verdadeiro só quando a espera passa do limiar.
 *
 * Fica aqui, e não em cada tela, porque o limiar é uma decisão de produto e não
 * pode variar por lugar: esqueleto aparecendo com régua diferente em cada
 * canto é a mesma inconsistência que ele deveria resolver.
 */
export function useEsperaLonga(esperando: boolean): boolean {
  const [longa, setLonga] = useState(false)

  useEffect(() => {
    if (!esperando) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect --
         apagar o sinal quando a espera acaba é o propósito do efeito */
      setLonga(false)
      return
    }
    const t = setTimeout(() => setLonga(true), ATRASO_DO_ESQUELETO)
    return () => clearTimeout(t)
  }, [esperando])

  return longa
}

/**
 * A área que vira esqueleto **se** a próxima tela demorar.
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
  const demorou = useEsperaLonga(troca?.pendente ?? false)

  return demorou ? <>{esqueleto}</> : <>{children}</>
}
