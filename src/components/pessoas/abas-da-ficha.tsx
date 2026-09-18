'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Abas } from '../ui/abas'

/**
 * As abas da ficha, que trocam sem ir ao servidor.
 *
 * Elas eram link com `?aba=`, e cada clique era um pedido inteiro: a ficha, os
 * contratos, as cobranças e os recibos vinham de novo para desenhar um pedaço
 * que já estava em mãos. Enquanto isso a tela ficava parada na aba anterior,
 * porque mudar só o `searchParams` do mesmo segmento não atravessa
 * `loading.tsx`. Sete abas assim é o que faz o sistema parecer travado.
 *
 * Agora o servidor manda os painéis junto com a ficha e a troca é local: o
 * conteúdo aparece no primeiro quadro. A URL continua contando qual aba está
 * aberta, por `pushState`, então recarregar, voltar e mandar o endereço para
 * alguém continuam funcionando, sem que isso custe uma ida ao servidor.
 *
 * A exceção é a avaliação, que busca o próprio dado ao abrir: ver
 * `PainelDeAvaliacao`.
 */
export function AbasDaFicha({
  itens, inicial, base, padrao = 'agenda', paineis, children,
}: {
  itens: Array<{ id: string; rotulo: ReactNode; contagem?: number }>
  /** a aba que a URL pediu quando a página foi desenhada */
  inicial: string
  /** o endereço da ficha, sem busca: `/pessoas/<id>` */
  base: string
  /** a aba que não precisa aparecer na URL */
  padrao?: string
  paineis: Record<string, ReactNode>
  /** a coluna da direita, que não depende da aba */
  children: ReactNode
}) {
  const [aba, setAba] = useState(inicial)

  /* voltar e avançar do navegador continuam mandando na aba */
  useEffect(() => {
    const aoVoltar = () => {
      const pedida = new URLSearchParams(window.location.search).get('aba')
      setAba(pedida && paineis[pedida] ? pedida : padrao)
    }
    window.addEventListener('popstate', aoVoltar)
    return () => window.removeEventListener('popstate', aoVoltar)
  }, [paineis, padrao])

  function trocar(id: string) {
    setAba(id)
    /*
     * `history.pushState` e não `router.push`: o Next entende esta troca como
     * mudança de URL sem navegação, que é exatamente o que ela é. Com
     * `router.push` o servidor redesenharia a ficha inteira para devolver o
     * mesmo que já está na tela.
     */
    window.history.pushState(null, '', id === padrao ? base : `${base}?aba=${id}`)
  }

  return (
    <>
      <Abas
        className="self-start"
        rotuloDoGrupo="O que ver desta ficha"
        ativo={aba}
        aoTrocar={trocar}
        itens={itens}
      />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_312px]">
        <div className="flex min-w-0 flex-col gap-3.5">
          {paineis[aba] ?? paineis[padrao] ?? null}
        </div>
        {children}
      </div>
    </>
  )
}
