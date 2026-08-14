'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Botao } from '@/components/ui/botao'
import { marcarPasso, concluir, pular } from '@/server/onboarding/acoes'
import type { Passo } from '@/core/onboarding/roteiro'

/** o balão nunca encosta na borda da janela, nem no elemento que aponta */
const FOLGA = 12
const LARGURA = 320

type Caixa = { top: number; left: number; width: number; height: number }

/**
 * Os apontamentos: um balão de cada vez, em cima da tela de verdade.
 *
 * Sobre a tela real, e não numa simulação, porque o objetivo é a pessoa
 * reconhecer o lugar depois. Uma simulação ensina a usar a simulação.
 *
 * O guia **não navega sozinho**. Quando o passo é de outra tela, ele encolhe
 * num cartão de canto que diz onde é e oferece ir; sequestrar a navegação de
 * quem está no meio de uma tarefa é pior do que um passo a mais.
 */
export function Guia({ passos, passoInicial }: { passos: Passo[]; passoInicial: number }) {
  const [i, setI] = useState(Math.min(passoInicial, Math.max(0, passos.length - 1)))
  const [fora, setFora] = useState(false)
  const [caixa, setCaixa] = useState<Caixa | null>(null)
  const pathname = usePathname()
  const router = useRouter()

  const passo = passos[i]
  const naTela = !!passo && pathname === passo.href

  /*
   * A posição do alvo muda com rolagem, com o tamanho da janela e com o dado
   * que chega depois. Medir uma vez na montagem deixa o balão apontando o vazio
   * na primeira rolagem, então a medida é refeita nos três eventos.
   */
  const medir = useCallback(() => {
    if (!passo || !naTela) return setCaixa(null)
    const alvo = document.querySelector(`[data-guia="${passo.alvo}"]`)
    if (!alvo) return setCaixa(null)
    const r = alvo.getBoundingClientRect()
    setCaixa({ top: r.top, left: r.left, width: r.width, height: r.height })
  }, [passo, naTela])

  useEffect(() => {
    if (fora) return
    // a primeira medida vai depois da pintura, e não no corpo do efeito: medir
    // antes de o navegador desenhar dá retângulo de tamanho zero, e medir
    // dentro do efeito é render em cascata
    const quadro = requestAnimationFrame(medir)
    // a segunda cobre o conteúdo que só chega depois (dado, fonte, imagem)
    const atrasada = setTimeout(medir, 400)
    window.addEventListener('scroll', medir, true)
    window.addEventListener('resize', medir)
    return () => {
      cancelAnimationFrame(quadro)
      clearTimeout(atrasada)
      window.removeEventListener('scroll', medir, true)
      window.removeEventListener('resize', medir)
    }
  }, [medir, fora])

  if (!passo || fora) return null

  function sair() {
    setFora(true)
    void pular('primeiros-passos')
  }

  function seguir() {
    if (i + 1 >= passos.length) {
      setFora(true)
      void concluir('primeiros-passos')
      return
    }
    const proximo = i + 1
    setI(proximo)
    void marcarPasso('primeiros-passos', proximo)
    if (passos[proximo].href !== pathname) router.push(passos[proximo].href)
  }

  const conteudo = (
    <>
      <p className="font-mono text-[10.5px] tracking-[.12em] text-tinta-fraca uppercase">
        Passo {i + 1} de {passos.length}
      </p>
      <h2 className="pt-1.5 font-titulo text-[17px] leading-[1.2] font-semibold">
        {passo.titulo}
      </h2>
      <p className="pt-1.5 text-[12.5px] leading-[1.55] text-tinta-media">
        {naTela ? passo.texto : 'Este passo mora em outra tela.'}
      </p>
      <div className="flex items-center gap-2 pt-3.5">
        <Botao miudo tom="fantasma" onClick={sair} className="mr-auto">
          Pular
        </Botao>
        {naTela ? (
          <Botao miudo onClick={seguir}>
            {i + 1 >= passos.length ? 'Terminar' : 'Continuar'}
          </Botao>
        ) : (
          <Botao miudo onClick={() => router.push(passo.href)}>
            Ir para a tela
          </Botao>
        )}
      </div>
    </>
  )

  // fora da tela do passo, ou sem o alvo montado: cartão de canto, sem apagar
  // nada da página. Um vidro escuro sobre uma tela que não é a do passo só
  // atrapalharia quem está trabalhando
  if (!naTela || !caixa) {
    return (
      <aside className="fixed right-4 bottom-24 z-50 w-[min(92vw,320px)] rounded-cartao border border-linha bg-superficie p-4 shadow-modal md:bottom-6">
        {conteudo}
      </aside>
    )
  }

  // cabe embaixo do alvo? senão vai por cima dele
  const abaixo = caixa.top + caixa.height + FOLGA + 210 < window.innerHeight
  const topo = abaixo
    ? caixa.top + caixa.height + FOLGA
    : Math.max(FOLGA, caixa.top - 210 - FOLGA)
  const esquerda = Math.min(
    Math.max(FOLGA, caixa.left),
    Math.max(FOLGA, window.innerWidth - LARGURA - FOLGA),
  )

  return (
    <>
      {/*
        * O apagado é uma sombra gigante em volta do recorte, e não quatro
        * retângulos: assim o alvo continua nítido, sem nada por cima dele, e o
        * `pointer-events-none` deixa a tela continuar clicável — o passo é para
        * ser feito, não assistido.
        */}
      <div
        aria-hidden
        className="pointer-events-none fixed z-40 rounded-media transition-[top,left,width,height] duration-200"
        style={{
          top: caixa.top - 6,
          left: caixa.left - 6,
          width: caixa.width + 12,
          height: caixa.height + 12,
          boxShadow: '0 0 0 9999px rgba(18,33,28,.5)',
        }}
      />
      <aside
        className="fixed z-50 rounded-cartao border border-linha bg-superficie p-4 shadow-modal"
        style={{ top: topo, left: esquerda, width: `min(92vw, ${LARGURA}px)` }}
      >
        {conteudo}
      </aside>
    </>
  )
}
