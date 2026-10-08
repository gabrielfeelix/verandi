'use client'

import { useEffect, useSyncExternalStore } from 'react'

/*
 * O nome do registro aberto, para a trilha do cabeçalho.
 *
 * O cabeçalho mora no layout e não sabe de quem é a ficha: só a página sabe.
 * Ela avisa por aqui, e a trilha troca "Ficha" por "Maria Silva". Guarda de
 * módulo, e não contexto, porque o cabeçalho é irmão do miolo, não pai.
 */
let atual: string | null = null
const ouvintes = new Set<() => void>()
const avisar = () => { for (const o of ouvintes) o() }

function assinar(o: () => void) {
  ouvintes.add(o)
  return () => { ouvintes.delete(o) }
}

export function useFimDaTrilha() {
  return useSyncExternalStore(assinar, () => atual, () => null)
}

/** A página põe isto no meio dela; some sozinho quando a pessoa sai. */
export function FimDaTrilha({ rotulo }: { rotulo: string }) {
  useEffect(() => {
    atual = rotulo
    avisar()
    return () => {
      if (atual === rotulo) atual = null
      avisar()
    }
  }, [rotulo])
  return null
}
