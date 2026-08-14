'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { Botao } from './botao'
import { TINTA, type Tinta } from './tintas'

/** 452 para confirmar, 520 para formulário, 588 quando há lista dentro. */
export type LarguraModal = 'confirmacao' | 'formulario' | 'lista'

const LARGURA: Record<LarguraModal, string> = {
  confirmacao: 'w-[min(92vw,452px)]',
  formulario: 'w-[min(92vw,520px)]',
  lista: 'w-[min(92vw,588px)]',
}

/**
 * O modal do protótipo: ícone com tinta, título, subtítulo, corpo e duas ações.
 *
 * Usa `<dialog>` nativo porque ele já traz o que costuma ser reimplementado
 * errado — foco preso dentro, `Esc` para fechar, e o resto da página inerte
 * para o leitor de tela.
 *
 * **Quem rola é o corpo, nunca a página.** Cabeçalho e rodapé ficam parados: um
 * modal de confirmação cuja lista de afetados empurra o botão "Encerrar" para
 * fora da tela é um modal que faz a pessoa confirmar às cegas.
 */
export function Modal({
  aberto, glifo = '+', tom = 'positivo', titulo, sub,
  primario, aoConfirmar, secundario = 'Cancelar', aoFechar,
  perigo = false, pendente = false, largura = 'formulario', children,
}: {
  aberto: boolean
  glifo?: string
  tom?: Tinta
  titulo: string
  sub?: string
  /**
   * A ação que confirma. Opcional porque nem todo modal confirma alguma coisa:
   * o de encaixe aplica no toque do nome e só precisa de um "Fechar".
   */
  primario?: string
  aoConfirmar?: () => void
  secundario?: string
  aoFechar: () => void
  perigo?: boolean
  pendente?: boolean
  largura?: LarguraModal
  children?: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (aberto && !d.open) d.showModal()
    if (!aberto && d.open) d.close()
  }, [aberto])

  return (
    <dialog
      ref={ref}
      onClose={aoFechar}
      onClick={(e) => { if (e.target === ref.current) aoFechar() }}
      className={`m-auto max-h-[calc(100dvh-56px)] overflow-hidden rounded-modal bg-superficie p-0 shadow-modal backdrop:bg-escuro/42 backdrop:backdrop-blur-[3px] ${LARGURA[largura]}`}
      style={{ animation: aberto ? 'vd-pop .26s var(--ease-pop) both' : undefined }}
    >
      <div className="flex max-h-[calc(100dvh-56px)] flex-col">
        <header className="flex shrink-0 items-start gap-3 px-6 pt-[22px] pb-4">
          <span
            aria-hidden
            className={`flex size-9 shrink-0 items-center justify-center rounded-padrao text-[15px] ${TINTA[perigo ? 'alerta' : tom]}`}
          >
            {perigo ? '!' : glifo}
          </span>
          <div className="flex flex-col gap-1">
            <h2 className="font-titulo text-[20px] font-semibold tracking-[-.02em]">
              {titulo}
            </h2>
            {sub ? <p className="text-[12.5px] text-tinta-apagada">{sub}</p> : null}
          </div>
        </header>

        {children ? (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pb-1">
            {children}
          </div>
        ) : null}

        {/* o secundário empurra o primário para a direita: a ação que confirma
            fica sempre no mesmo canto, em todo modal do produto */}
        <footer className="flex shrink-0 items-center gap-2 border-t border-linha-fina px-6 pt-4 pb-5">
          <Botao tom="secundario" onClick={aoFechar} className="flex-1">
            {secundario}
          </Botao>
          {primario && aoConfirmar ? (
            <Botao
              tom={perigo ? 'perigo' : 'primario'}
              onClick={aoConfirmar}
              disabled={pendente}
            >
              {primario}
            </Botao>
          ) : null}
        </footer>
      </div>
    </dialog>
  )
}
