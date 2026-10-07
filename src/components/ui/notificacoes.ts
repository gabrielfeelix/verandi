'use client'

import { useMemo, useSyncExternalStore } from 'react'
import type { Notificacao } from '@/server/notificacoes'

/**
 * O estado das notificações no navegador, num lugar só.
 *
 * Quem busca é o `AvisosDoNavegador`, que mora no layout e roda em qualquer
 * tela; quem mostra é o sino do Hoje. Os dois leem daqui, então o sino aberto
 * recebe a novidade sem recarregar a página.
 *
 * Duas listas no `localStorage`, porque são duas perguntas: `vistas` é o que
 * já passou pelos olhos ao abrir o sino (a contagem some ao abrir), `lidas` é
 * o que foi clicado (o ponto ao lado some). Os ids voltam do servidor e as
 * antigas saem sozinhas junto com os sete dias.
 */
const VISTAS = 'verandi:notificacoes-vistas'
const LIDAS = 'verandi:notificacoes-lidas'

let atual: Notificacao[] | null = null
const ouvintes = new Set<() => void>()
const avisarTodos = () => { for (const o of ouvintes) o() }

function assinar(o: () => void) {
  ouvintes.add(o)
  // outra aba marcando como lida conta aqui também
  window.addEventListener('storage', o)
  return () => { ouvintes.delete(o); window.removeEventListener('storage', o) }
}

export function publicarNotificacoes(lista: Notificacao[]) {
  atual = lista
  avisarTodos()
}

function ler(chave: string): string {
  try { return localStorage.getItem(chave) ?? '[]' } catch { return '[]' }
}

function juntar(chave: string, ids: string[]) {
  let antes: string[] = []
  try { antes = JSON.parse(ler(chave)) as string[] } catch { antes = [] }
  const depois = [...new Set([...antes, ...ids])].slice(-300)
  try { localStorage.setItem(chave, JSON.stringify(depois)) } catch { /* sem espaço */ }
  avisarTodos()
}

export const marcarVistas = (ids: string[]) => juntar(VISTAS, ids)
export const marcarLida = (id: string) => juntar(LIDAS, [id])

function useLista(chave: string): Set<string> {
  const cru = useSyncExternalStore(assinar, () => ler(chave), () => '[]')
  return useMemo(() => {
    try { return new Set(JSON.parse(cru) as string[]) } catch { return new Set<string>() }
  }, [cru])
}

export function useNotificacoes(inicial: Notificacao[]) {
  const lista = useSyncExternalStore(assinar, () => atual, () => null) ?? inicial
  const vistas = useLista(VISTAS)
  const lidas = useLista(LIDAS)
  return { lista, vistas, lidas }
}
