'use client'

import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'

/**
 * Cola o painel embaixo do campo — ou em cima, quando não cabe embaixo.
 *
 * `position: fixed`, e não `absolute`, por causa de onde estes campos moram: o
 * corpo do modal rola por dentro (`overflow-y-auto`), e ali um painel absoluto
 * é cortado na borda do card. Fixo escapa do corte porque o `<dialog>` termina
 * a animação em `transform: none` — com transform aplicado ele viraria bloco de
 * contenção, e o fixo voltaria a ser cortado.
 *
 * Mede e escreve direto no `style` do nó, sem estado: posição de painel é
 * resultado de layout, e passar por `useState` custaria uma renderização a
 * mais a cada pixel de rolagem. Roda em `useLayoutEffect`, antes da pintura,
 * então ninguém vê o painel no canto superior esquerdo antes de ir para o
 * lugar.
 */
export function usePosicionar(
  ancora: RefObject<HTMLElement | null>,
  aberto: boolean,
  larguraMinima = 260,
  /** o calendário tem largura própria: esticar até a do campo o deixa ralo */
  larguraFixa?: number,
) {
  // o nó do painel é do próprio gancho: quem escreve no `style` tem que ser
  // dono da referência, senão o compilador do React acusa mutação de argumento
  const painel = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!aberto) return

    function posicionar() {
      const a = ancora.current
      const p = painel.current
      if (!a || !p) return

      const r = a.getBoundingClientRect()
      const largura = larguraFixa ?? Math.max(r.width, larguraMinima)
      const folgaAbaixo = window.innerHeight - r.bottom
      const cabeAbaixo = folgaAbaixo >= p.offsetHeight + 8 || r.top < folgaAbaixo

      p.style.position = 'fixed'
      p.style.width = `${largura}px`
      p.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - largura - 8))}px`
      if (cabeAbaixo) {
        p.style.bottom = ''
        p.style.top = `${r.bottom + 6}px`
      } else {
        p.style.top = ''
        p.style.bottom = `${window.innerHeight - r.top + 6}px`
      }
    }

    posicionar()
    window.addEventListener('resize', posicionar)
    // `true` para pegar a rolagem do corpo do modal, que não borbulha
    window.addEventListener('scroll', posicionar, true)
    return () => {
      window.removeEventListener('resize', posicionar)
      window.removeEventListener('scroll', posicionar, true)
    }
  }, [ancora, aberto, larguraMinima, larguraFixa])

  return painel
}

/** Fecha ao clicar fora do campo e do painel — o gesto que todo mundo espera. */
export function useFecharFora(
  refs: Array<RefObject<HTMLElement | null>>,
  aberto: boolean,
  fechar: () => void,
) {
  const guardado = useRef(fechar)
  useEffect(() => { guardado.current = fechar })

  useEffect(() => {
    if (!aberto) return
    function fora(e: PointerEvent) {
      const alvo = e.target as Node
      if (refs.some((r) => r.current?.contains(alvo))) return
      guardado.current()
    }
    document.addEventListener('pointerdown', fora)
    return () => document.removeEventListener('pointerdown', fora)
    // `refs` é um array literal recriado a cada render; o que importa aqui é
    // só abrir e fechar o ouvinte junto com o painel
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto])
}
