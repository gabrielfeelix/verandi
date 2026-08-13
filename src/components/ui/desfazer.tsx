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
          className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-lg items-center justify-between gap-4 rounded-[--radius-padrao] bg-escuro px-4 py-3 text-tinta-clara shadow-[--shadow-elevado]"
          style={{ animation: 'vd-sobe .12s ease-out' }}
        >
          <span className="text-[13px]">{aviso.texto}</span>
          {aviso.desfazer ? (
            <button
              type="button"
              onClick={() => { aviso.desfazer?.(); setAviso(null) }}
              className="min-h-9 shrink-0 px-2 text-[13px] font-medium text-menta underline"
            >
              Desfazer
            </button>
          ) : null}
        </div>
      ) : null}
    </Contexto.Provider>
  )
}
