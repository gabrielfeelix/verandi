'use client'

import {
  createContext, useContext, useEffect, useRef, useState, useTransition, type ReactNode,
} from 'react'
import { semAcento } from '@/core/pessoas/busca'
import { useRouter } from 'next/navigation'

/**
 * O que está digitado agora, para a lista filtrar sem esperar o servidor.
 *
 * A busca ia ao servidor a cada pausa e a página inteira era refeita lá: com a
 * MGM, "thais" levava segundos para mudar a tela. Agora a lista já carregada
 * se recorta na hora, letra a letra, e o servidor responde por trás com o
 * resultado de todas as páginas.
 */
type Digitado = {
  texto: string; setTexto: (t: string) => void
  pendente: boolean; setPendente: (p: boolean) => void
  /** o `q` que a página carregada respondeu */
  servidor: string
}
const Contexto = createContext<Digitado | null>(null)

export function ProvedorDeBusca({ servidor, children }: { servidor: string; children: ReactNode }) {
  const [texto, setTexto] = useState(servidor)
  const [pendente, setPendente] = useState(false)
  return (
    <Contexto.Provider value={{ texto, setTexto, pendente, setPendente, servidor }}>
      {children}
    </Contexto.Provider>
  )
}

/** As linhas que casam com o que está digitado, e se o servidor ainda vai responder. */
export function useFiltroLocal<T extends { pessoaNome: string }>(linhas: T[]) {
  const c = useContext(Contexto)
  const termo = semAcento(c?.texto.trim() ?? '')
  return {
    linhas: termo ? linhas.filter((l) => semAcento(l.pessoaNome).includes(termo)) : linhas,
    // entre a letra e a resposta, lista vazia não é "nada encontrado"
    procurando: (c?.pendente ?? false) || (c ? c.texto.trim() !== c.servidor : false),
  }
}

/**
 * A busca por nome, que filtra enquanto se digita.
 *
 * Mesma decisão da lista de pessoas: o `Enter` sozinho fazia quem digitava
 * concluir que a busca não funcionava. O endereço continua sendo a verdade, e
 * o `replace` evita uma entrada de histórico por letra.
 */
export function BuscaDeCobranca({
  valorInicial, aba,
}: {
  valorInicial: string
  aba: string
}) {
  const c = useContext(Contexto)
  const [textoProprio, setTextoProprio] = useState(valorInicial)
  const texto = c?.texto ?? textoProprio
  const setTexto = c?.setTexto ?? setTextoProprio
  const [pendente, iniciar] = useTransition()
  const avisarPendente = c?.setPendente
  useEffect(() => { avisarPendente?.(pendente) }, [pendente, avisarPendente])
  const router = useRouter()
  const primeira = useRef(true)

  /*
   * O endereço só reescreve o campo quando mudou por fora (troca de aba, voltar
   * do navegador). A resposta de "tha" chegando com "thais" já digitado não
   * pode apagar as duas letras que vieram depois.
   */
  const enviado = useRef(valorInicial)
  useEffect(() => {
    if (valorInicial === enviado.current) return
    enviado.current = valorInicial
    setTexto(valorInicial)
  }, [valorInicial, setTexto])

  useEffect(() => {
    if (primeira.current) { primeira.current = false; return }
    if (texto.trim() === valorInicial) return
    const t = setTimeout(() => {
      const busca = new URLSearchParams({ aba })
      if (texto.trim()) busca.set('q', texto.trim())
      enviado.current = texto.trim()
      iniciar(() => router.replace(`/financeiro?${busca}`, { scroll: false }))
    }, 200)
    return () => clearTimeout(t)
  }, [texto, valorInicial, aba, router])

  return (
    <form className="relative flex items-center" onSubmit={(e) => e.preventDefault()}>
      <label htmlFor="fin-busca" className="sr-only">Procurar por nome</label>
      <input
        id="fin-busca"
        name="q"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Procurar por nome"
        className="campo"
        autoComplete="off"
      />
      {pendente ? (
        <span className="absolute right-3 text-[12.5px] text-tinta-fraca">procurando</span>
      ) : null}
    </form>
  )
}
