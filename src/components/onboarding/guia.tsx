'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Botao } from '@/components/ui/botao'
import { marcarPasso, concluir, pular } from '@/server/onboarding/acoes'
import type { Passo } from '@/core/onboarding/roteiro'

/** o balão nunca encosta na borda da janela, nem no elemento que aponta */
const FOLGA = 14
const LARGURA = 330
const ALTURA_BALAO = 208

type Caixa = { top: number; left: number; width: number; height: number }

/**
 * A visita guiada: **a tela inteira escurece, e só o que está sendo apontado
 * fica aceso.**
 *
 * O escuro é uma sombra gigante em volta do recorte, e não quatro retângulos
 * nem um `filter` na página: assim o elemento apontado continua com a cor
 * original, sem nada por cima dele, e o balão fica branco por fora do escuro.
 * Foi por isso que a primeira versão parecia sem graça, ela escurecia o alvo
 * junto.
 *
 * O guia **navega sozinho** entre os passos, porque é uma visita: ele mostra o
 * menu, clica no item, mostra o que tem dentro, e segue. O que ele não faz é
 * prender: "Pular" está em todos os passos e é definitivo.
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
   *
   * Sem o elemento do passo, o alvo é a área de trabalho inteira: melhor
   * apontar a tela do que apontar o nada.
   */
  const medir = useCallback(() => {
    if (!passo || !naTela) return setCaixa(null)
    const alvo = document.querySelector(`[data-guia="${passo.alvo}"]`)
      ?? document.querySelector('[data-guia="tela"]')
    if (!alvo) return setCaixa(null)
    const r = alvo.getBoundingClientRect()
    // a área de trabalho é mais alta que a janela; o recorte para na dobra,
    // senão o escuro vira uma moldura fina em volta de tudo
    const altura = Math.min(r.height, window.innerHeight - r.top - FOLGA * 2)
    setCaixa({ top: r.top, left: r.left, width: r.width, height: Math.max(64, altura) })
  }, [passo, naTela])

  // o passo manda na navegação: é ele quem leva a pessoa até a tela
  useEffect(() => {
    if (fora || !passo || naTela) return
    router.push(passo.href)
  }, [fora, passo, naTela, router])

  useEffect(() => {
    if (fora) return
    const quadro = requestAnimationFrame(medir)
    // a segunda medida cobre o que só chega depois (dado, fonte, imagem)
    const atrasada = setTimeout(medir, 350)
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
  }

  function voltar() {
    if (i === 0) return
    const anterior = i - 1
    setI(anterior)
    void marcarPasso('primeiros-passos', anterior)
  }

  /*
   * Sem caixa (trocando de tela, ou alvo ainda não montado) o escuro continua,
   * e o balão vai para o meio. O que não pode acontecer é a tela clarear entre
   * um passo e outro: pisca, e parece que a visita acabou.
   */
  const centro = !caixa
  const abaixo = caixa
    ? caixa.top + caixa.height + FOLGA + ALTURA_BALAO < window.innerHeight
    : false
  const topo = caixa
    ? (abaixo
        ? caixa.top + caixa.height + FOLGA
        : Math.max(FOLGA, caixa.top - ALTURA_BALAO - FOLGA))
    : 0
  const esquerda = caixa
    ? Math.min(
        Math.max(FOLGA, caixa.left),
        Math.max(FOLGA, window.innerWidth - LARGURA - FOLGA),
      )
    : 0

  return (
    <>
      {/*
        * `pointer-events-none` de propósito: a pessoa continua podendo usar a
        * tela durante a visita. O passo é para ser feito, não assistido.
        */}
      <div
        aria-hidden
        className="pointer-events-none fixed z-40 rounded-media transition-[top,left,width,height] duration-300 ease-out"
        style={
          caixa
            ? {
                top: caixa.top - 8,
                left: caixa.left - 8,
                width: caixa.width + 16,
                height: caixa.height + 16,
                boxShadow: '0 0 0 9999px rgba(11,20,17,.72)',
                outline: '2px solid rgba(42,195,163,.55)',
                outlineOffset: 0,
              }
            : {
                top: '50%', left: '50%', width: 0, height: 0,
                boxShadow: '0 0 0 9999px rgba(11,20,17,.72)',
              }
        }
      />

      <aside
        aria-live="polite"
        className="fixed z-50 rounded-cartao border border-linha bg-superficie p-4 shadow-modal"
        style={
          centro
            ? {
                top: '50%', left: '50%',
                transform: 'translate(-50%,-50%)',
                width: `min(92vw, ${LARGURA}px)`,
              }
            : { top: topo, left: esquerda, width: `min(92vw, ${LARGURA}px)` }
        }
      >
        <p className="font-mono text-[10.5px] tracking-[.12em] text-tinta-fraca uppercase">
          Passo {i + 1} de {passos.length}
        </p>
        <h2 className="pt-1.5 font-titulo text-[17px] leading-[1.2] font-semibold">
          {passo.titulo}
        </h2>
        <p className="pt-1.5 text-[12.5px] leading-[1.55] text-tinta-media">
          {passo.texto}
        </p>

        {/* os pontos dizem quanto falta sem obrigar a contar */}
        <div aria-hidden className="flex gap-1 pt-3.5">
          {passos.map((p, n) => (
            <span
              key={`${p.href}-${p.alvo}`}
              className={`h-[3px] flex-1 rounded-sm transition-colors duration-200 ${
                n <= i ? 'bg-escuro' : 'bg-linha'
              }`}
            />
          ))}
        </div>

        <div className="flex items-center gap-2 pt-3">
          <Botao miudo tom="fantasma" onClick={sair}>Pular</Botao>
          {i > 0 ? (
            <Botao miudo tom="secundario" onClick={voltar} className="ml-auto">
              Voltar
            </Botao>
          ) : null}
          <Botao miudo onClick={seguir} className={i > 0 ? '' : 'ml-auto'}>
            {i + 1 >= passos.length ? 'Terminar' : 'Próxima'}
          </Botao>
        </div>
      </aside>
    </>
  )
}
