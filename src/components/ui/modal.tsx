'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { Botao } from './botao'
import { TINTA, type Tinta } from './tintas'

/**
 * O modal do protótipo: ícone com tinta, título, subtítulo, corpo e duas ações.
 *
 * Usa `<dialog>` nativo porque ele já traz o que costuma ser reimplementado
 * errado — foco preso dentro, `Esc` para fechar, e o resto da página inerte
 * para o leitor de tela.
 */
export function Modal({
  aberto, glifo = '+', tom = 'positivo', titulo, sub,
  primario, aoConfirmar, secundario = 'Cancelar', aoFechar,
  perigo = false, pendente = false, children,
}: {
  aberto: boolean
  glifo?: string
  tom?: Tinta
  titulo: string
  sub?: string
  primario: string
  aoConfirmar: () => void
  secundario?: string
  aoFechar: () => void
  perigo?: boolean
  pendente?: boolean
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
      className="m-auto w-[min(92vw,520px)] rounded-[--radius-cartao] bg-superficie p-0 shadow-[--shadow-modal] backdrop:bg-escuro/40"
    >
      <div className="flex flex-col gap-4 p-5">
        <header className="flex items-start gap-3">
          <span
            aria-hidden
            className={`flex size-9 shrink-0 items-center justify-center rounded-[--radius-padrao] text-[15px] ${TINTA[perigo ? 'alerta' : tom]}`}
          >
            {glifo}
          </span>
          <div className="flex flex-col gap-1">
            <h2 className="font-titulo text-[19px] font-semibold tracking-[-.02em]">
              {titulo}
            </h2>
            {sub ? <p className="text-[12.5px] text-tinta-media">{sub}</p> : null}
          </div>
        </header>

        {children ? <div className="flex flex-col gap-4">{children}</div> : null}

        <footer className="flex flex-wrap justify-end gap-2">
          <Botao tom="secundario" onClick={aoFechar}>{secundario}</Botao>
          <Botao
            tom={perigo ? 'perigo' : 'primario'}
            onClick={aoConfirmar}
            disabled={pendente}
          >
            {primario}
          </Botao>
        </footer>
      </div>
    </dialog>
  )
}
