'use client'

import { useId, useMemo, useRef, useState } from 'react'
import { Icone } from './icones'
import { useFecharFora, usePosicionar } from './flutuante'

export type OpcaoEscolha = {
  valor: string
  rotulo: string
  /** a segunda linha: professor, sala, telefone — o que desambigua */
  detalhe?: string
  /** o cabeçalho que agrupa: "Segunda", "Terça" */
  grupo?: string
}

const semAcento = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * O seletor da casa, no lugar do `<select>` nativo.
 *
 * O nativo não é feio por capricho de gosto: ele é desenhado pelo sistema
 * operacional, ignora todo o design system, e com setenta horários abre uma
 * lista branca de sistema que cobre meia tela e não diz mais que uma linha de
 * texto por item. Escolher "terça 11:00" ali é rolar caçando, sem ver de quem é
 * a turma nem em que sala.
 *
 * Aqui a mesma escolha vem agrupada por dia, com o detalhe embaixo do nome, e
 * com um campo de filtro assim que a lista passa de oito itens — digitar "ter 11"
 * chega mais rápido que qualquer rolagem.
 *
 * O valor viaja num `<input type="hidden">`: quem usa continua lendo o
 * `FormData` do formulário, igual a um `<select>`.
 */
export function Escolha({
  nome, opcoes, valorInicial = '', placeholder = 'escolha', aoTrocar,
  autoFocus = false, id, invalido = false,
}: {
  nome: string
  opcoes: OpcaoEscolha[]
  valorInicial?: string
  placeholder?: string
  aoTrocar?: (valor: string) => void
  autoFocus?: boolean
  id?: string
  invalido?: boolean
}) {
  const [valor, setValor] = useState(valorInicial)
  const [aberto, setAberto] = useState(false)
  const [filtro, setFiltro] = useState('')
  const [foco, setFoco] = useState(0)
  const botao = useRef<HTMLButtonElement>(null)
  const idLista = useId()
  const painel = usePosicionar(botao, aberto)
  useFecharFora([botao, painel], aberto, () => setAberto(false))

  const escolhida = opcoes.find((o) => o.valor === valor)
  const temFiltro = opcoes.length > 8

  const visiveis = useMemo<Array<OpcaoEscolha & { abreGrupo: boolean }>>(() => {
    const t = semAcento(filtro.trim())
    // cada pedaço do que foi digitado precisa aparecer em algum lugar da linha:
    // "ter 11" acha "Terça 11:00", que uma busca por frase inteira perderia
    const partes = t.split(/\s+/)
    const achadas = t
      ? opcoes.filter((o) => {
          const alvo = semAcento(`${o.grupo ?? ''} ${o.rotulo} ${o.detalhe ?? ''}`)
          return partes.every((p) => alvo.includes(p))
        })
      : opcoes
    /*
     * O cabeçalho de grupo é decidido **aqui**, e não durante a renderização
     * da lista.
     *
     * Antes era um `let grupoAtual` reatribuído dentro do `map`: mutação de
     * variável durante a renderização, que o compilador do React proíbe. Em
     * desenvolvimento passava; no build de produção o modal inteiro morria com
     * "Minified React error #441" no lugar do formulário.
     */
    return achadas.map((o, i) => ({
      ...o,
      abreGrupo: Boolean(o.grupo) && o.grupo !== achadas[i - 1]?.grupo,
    }))
  }, [opcoes, filtro])

  function abrir() {
    setFiltro('')
    setFoco(Math.max(0, visiveis.findIndex((o) => o.valor === valor)))
    setAberto(true)
  }

  function escolher(o: OpcaoEscolha) {
    setValor(o.valor)
    aoTrocar?.(o.valor)
    setAberto(false)
    botao.current?.focus()
  }

  function teclado(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setAberto(false); botao.current?.focus(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setFoco((i) => Math.min(i + 1, visiveis.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setFoco((i) => Math.max(i - 1, 0)) }
    if (e.key === 'Home') { e.preventDefault(); setFoco(0) }
    if (e.key === 'End') { e.preventDefault(); setFoco(visiveis.length - 1) }
    if (e.key === 'Enter' && visiveis[foco]) { e.preventDefault(); escolher(visiveis[foco]) }
  }

  return (
    <>
      <input type="hidden" name={nome} value={valor} />
      <button
        ref={botao}
        id={id}
        type="button"
        autoFocus={autoFocus}
        role="combobox"
        aria-expanded={aberto}
        aria-controls={idLista}
        aria-haspopup="listbox"
        /*
         * Abre e fecha no `pointerdown`, não no `click`.
         *
         * O rótulo do campo aponta para este botão (`htmlFor`), então clicar em
         * "Qual horário?" vira um clique aqui. Com `click`, a sequência era:
         * o `pointerdown` fora fechava o painel, e o `click` do rótulo abria de
         * novo — o painel piscava e parecia que não fechava nunca. No
         * `pointerdown` os dois acontecem no mesmo instante, e o de dentro
         * ganha.
         */
        onPointerDown={(e) => {
          e.preventDefault()
          if (aberto) setAberto(false)
          else abrir()
        }}
        onKeyDown={(e) => {
          if (!aberto && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            abrir()
          }
        }}
        className={`campo flex w-full items-center gap-2 text-left ${
          invalido ? 'border-alerta-linha-forte bg-alerta-superficie' : ''
        } ${escolhida ? '' : 'text-tinta-fraca'}`}
      >
        <span className="min-w-0 flex-1 truncate">
          {escolhida ? escolhida.rotulo : placeholder}
        </span>
        {escolhida?.detalhe ? (
          <span className="hidden shrink-0 text-[13px] text-tinta-fraca sm:block">
            {escolhida.detalhe}
          </span>
        ) : null}
        <Icone
          nome="depois" tamanho={16}
          className={`shrink-0 text-tinta-fraca transition-transform duration-150 ${
            aberto ? '-rotate-90' : 'rotate-90'
          }`}
        />
      </button>

      {aberto ? (
        <div
          ref={painel}
          style={{ position: 'fixed', zIndex: 70 }}
          className="flex max-h-[320px] flex-col overflow-hidden rounded-grande border border-linha bg-superficie shadow-modal"
        >
          {temFiltro ? (
            <div className="flex shrink-0 items-center gap-2 border-b border-linha-fina px-3 py-2">
              <span aria-hidden className="font-mono text-[14px] text-tinta-fraca">⌕</span>
              <input
                autoFocus
                value={filtro}
                onChange={(e) => { setFiltro(e.target.value); setFoco(0) }}
                onKeyDown={teclado}
                placeholder="Filtrar"
                aria-label="Filtrar a lista"
                className="min-w-0 flex-1 bg-transparent text-[14.5px] outline-none placeholder:text-tinta-fraca"
              />
              {filtro ? (
                <span className="shrink-0 text-[12.5px] text-tinta-fraca">
                  {visiveis.length}
                </span>
              ) : null}
            </div>
          ) : null}

          <ul
            id={idLista}
            role="listbox"
            tabIndex={temFiltro ? -1 : 0}
            onKeyDown={temFiltro ? undefined : teclado}
            className="min-h-0 flex-1 overflow-y-auto p-1.5 outline-none"
          >
            {visiveis.length === 0 ? (
              <li className="px-2.5 py-3 text-[13.5px] text-tinta-media">
                Nada com esse texto.
              </li>
            ) : (
              visiveis.map((o, i) => (
                  <li key={o.valor}>
                    {o.abreGrupo ? (
                      <p className="sticky top-0 z-10 bg-superficie px-2.5 pt-2 pb-1 text-[12px] font-semibold tracking-[.1em] text-tinta-fraca uppercase">
                        {o.grupo}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      role="option"
                      aria-selected={o.valor === valor}
                      onMouseEnter={() => setFoco(i)}
                      onClick={() => escolher(o)}
                      className={`flex w-full items-center gap-2.5 rounded-padrao px-2.5 py-2 text-left ${
                        i === foco ? 'bg-superficie-suave' : ''
                      }`}
                    >
                      <span className="flex min-w-0 flex-1 flex-col leading-tight">
                        <span className="truncate text-[14.5px] font-medium">{o.rotulo}</span>
                        {o.detalhe ? (
                          <span className="truncate text-[12.5px] text-tinta-fraca">
                            {o.detalhe}
                          </span>
                        ) : null}
                      </span>
                      {o.valor === valor ? (
                        <Icone nome="check" tamanho={16} className="shrink-0 text-marca" />
                      ) : null}
                    </button>
                  </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </>
  )
}
