'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

/**
 * "Desfazer, não confirmar."
 *
 * Nenhuma ação de registro pede confirmação: ela acontece e oferece desfazer por
 * seis segundos. Pedem confirmação só as destrutivas, e essas usam `Modal`.
 *
 * A barra é `role="status"` e não `role="alert"` de propósito: alerta interrompe
 * o leitor de tela no meio da frase, e registrar presença em lote dispararia um
 * por toque.
 */
type Aviso = { texto: string; desfazer?: () => void }

const Contexto = createContext<(a: Aviso) => void>(() => {})

export function useAviso() {
  return useContext(Contexto)
}

export function ProvedorDeAviso({ children }: { children: React.ReactNode }) {
  const [aviso, setAviso] = useState<Aviso | null>(null)

  const avisar = useCallback((a: Aviso) => setAviso(a), [])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 6000)
    return () => clearTimeout(t)
  }, [aviso])

  return (
    <Contexto.Provider value={avisar}>
      {children}
      {aviso ? (
        <div
          role="status"
          className="fixed inset-x-4 bottom-[26px] z-50 mx-auto flex max-w-lg items-center gap-4 rounded-media bg-escuro px-4 py-3.5 text-tinta-clara shadow-aviso"
          style={{ animation: 'vd-surge .34s var(--ease-sobe) both' }}
        >
          <span aria-hidden className="size-[7px] shrink-0 rounded-full bg-menta" />
          <span className="flex-1 text-[13.5px]">{aviso.texto}</span>
          {aviso.desfazer ? (
            <button
              type="button"
              onClick={() => { aviso.desfazer?.(); setAviso(null) }}
              className="min-h-9 shrink-0 cursor-pointer rounded-peca border border-tinta-clara/24 px-3 text-[12px] font-semibold text-tinta-clara transition-colors duration-150 hover:bg-tinta-clara/10"
            >
              Desfazer
            </button>
          ) : null}
        </div>
      ) : null}
    </Contexto.Provider>
  )
}
