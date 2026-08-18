'use client'

import { useEffect } from 'react'
import { travarPagina, destravarPagina } from '../ui/modal'
import { Icone } from '../ui/icones'
import { dataCurta } from '@/core/agenda/datas'

/**
 * A foto grande.
 *
 * O documento do cliente pede isto em letras maiúsculas, e o motivo é prático:
 * o que se procura numa foto de postura é um desnível de dois centímetros, e
 * isso não existe numa miniatura. Aqui a foto ocupa a altura inteira da janela,
 * o fundo é escuro para o olho não comparar a pele com o branco da tela, e as
 * setas andam pelas datas **da mesma posição**, que é a comparação que interessa.
 *
 * Não é um `<Modal>`: o modal do design system tem largura de formulário, e
 * esticá-lo até 900px para caber foto faria a próxima pessoa esticar de novo
 * para outra coisa. Isto é um visor, e a única coisa que ele empresta do modal
 * é a trava de rolagem, com o mesmo contador.
 */
export function Visor({
  aberto, posicao, data, url, observacao, temAnterior, temProxima, aoAndar, aoFechar,
}: {
  aberto: boolean
  posicao: string
  /** `YYYY-MM-DD` */
  data: string
  url: string
  observacao: string | null
  temAnterior: boolean
  temProxima: boolean
  aoAndar: (passo: -1 | 1) => void
  aoFechar: () => void
}) {
  useEffect(() => {
    if (!aberto) return
    travarPagina()
    return destravarPagina
  }, [aberto])

  useEffect(() => {
    if (!aberto) return
    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape') aoFechar()
      if (e.key === 'ArrowLeft' && temAnterior) aoAndar(-1)
      if (e.key === 'ArrowRight' && temProxima) aoAndar(1)
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [aberto, temAnterior, temProxima, aoAndar, aoFechar])

  if (!aberto) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${posicao}, ${dataCurta(data)}`}
      onClick={aoFechar}
      className="fixed inset-0 z-50 flex flex-col bg-escuro/94 backdrop-blur-[2px]"
    >
      <header
        onClick={(e) => e.stopPropagation()}
        className="flex items-center gap-3 px-4 py-3 md:px-6"
      >
        <span className="flex flex-col">
          <span className="font-titulo text-[17px] font-semibold text-tinta-clara">
            {posicao}
          </span>
          <span className="font-mono text-[12.5px] text-tinta-escura-media">
            {dataCurta(data)}
          </span>
        </span>
        <button
          type="button"
          onClick={aoFechar}
          aria-label="Fechar a foto"
          className="ml-auto flex size-11 items-center justify-center rounded-padrao border border-tinta-clara/20 text-tinta-clara hover:bg-tinta-clara/10"
        >
          <Icone nome="fechar" />
        </button>
      </header>

      <div
        onClick={(e) => e.stopPropagation()}
        className="flex min-h-0 flex-1 items-center gap-2 px-2 pb-2 md:gap-4 md:px-4 md:pb-4"
      >
        <button
          type="button"
          onClick={() => aoAndar(-1)}
          disabled={!temAnterior}
          aria-label="Avaliação anterior desta posição"
          className="flex size-11 shrink-0 items-center justify-center rounded-padrao border border-tinta-clara/20 text-tinta-clara disabled:opacity-30 hover:not-disabled:bg-tinta-clara/10"
        >
          <Icone nome="antes" />
        </button>

        {/* `object-contain`: cortar foto de postura é apagar justamente a
            perna que alguém foi conferir */}
{/* `<img>` e não `next/image`: o endereço é assinado e expira, e o
            otimizador do Next guardaria uma imagem privada de saúde atrás
            de uma URL que não expira junto. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={`${posicao} em ${dataCurta(data)}`}
          className="min-h-0 min-w-0 flex-1 rounded-grande object-contain"
          style={{ maxHeight: '100%' }}
        />

        <button
          type="button"
          onClick={() => aoAndar(1)}
          disabled={!temProxima}
          aria-label="Próxima avaliação desta posição"
          className="flex size-11 shrink-0 items-center justify-center rounded-padrao border border-tinta-clara/20 text-tinta-clara disabled:opacity-30 hover:not-disabled:bg-tinta-clara/10"
        >
          <Icone nome="depois" />
        </button>
      </div>

      {observacao ? (
        <p
          onClick={(e) => e.stopPropagation()}
          className="mx-auto max-w-[720px] px-6 pb-6 text-center text-[13px] leading-relaxed text-tinta-escura-media"
        >
          {observacao}
        </p>
      ) : null}
    </div>
  )
}
