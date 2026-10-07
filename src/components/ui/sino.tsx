'use client'

import { useRef, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { Icone, type NomeIcone } from './icones'
import { useFecharFora, usePosicionar } from './flutuante'
import { marcarLida, marcarVistas, useNotificacoes } from './notificacoes'
import type { Notificacao } from '@/server/notificacoes'

const TIPO: Record<Notificacao['tipo'], { icone: NomeIcone; tinta: string }> = {
  cancelada: { icone: 'proibido', tinta: 'bg-alerta-fundo text-alerta' },
  falta_avisada: { icone: 'aviso', tinta: 'bg-atencao-fundo text-atencao' },
  confirmada: { icone: 'check', tinta: 'bg-positivo-fundo text-positivo' },
  encaixe: { icone: 'mais', tinta: 'bg-positivo-fundo text-positivo' },
  reposicao: { icone: 'relogio', tinta: 'bg-neutro-fundo text-tinta-media' },
}

const diaDe = (d: Date) => d.toLocaleDateString('en-CA')

/** Hoje, Ontem, Nesta semana: a pergunta é "o que mudou desde a última vez" */
function grupoDe(iso: string): string {
  if (iso > new Date().toISOString()) return 'Canceladas à frente'
  const dia = diaDe(new Date(iso))
  if (dia === diaDe(new Date())) return 'Hoje'
  if (dia === diaDe(new Date(Date.now() - 864e5))) return 'Ontem'
  return 'Nesta semana'
}

function horaDe(iso: string, grupo: string): string {
  // a aula à frente já diz o dia e a hora no texto
  if (grupo === 'Canceladas à frente') return ''
  const d = new Date(iso)
  const h = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (grupo !== 'Nesta semana') return h
  return `${d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}, ${h}`
}

type Permissao = NotificationPermission | 'sem-suporte'
const lerPermissao = (): Permissao =>
  typeof Notification === 'undefined' ? 'sem-suporte' : Notification.permission
const ouvintesPermissao = new Set<() => void>()

/**
 * O sino, ao lado da busca.
 *
 * Aula cancelada, aluno que avisou que não vem, quem confirmou ou remarcou
 * pelo WhatsApp: coisas que o dono descobria tarde, pelo aluno na porta ou
 * pelo professor com uma pessoa a mais na sala.
 *
 * A contagem some ao abrir o painel (abrir é ter visto). O ponto em cada linha
 * some ao clicar nela (clicar é ter lido). A lista se atualiza sozinha: quem
 * busca é o `AvisosDoNavegador`, no layout.
 */
export function Sino({ itens }: { itens: Notificacao[] }) {
  const [aberto, setAberto] = useState(false)
  const botao = useRef<HTMLButtonElement>(null)
  const painel = usePosicionar(botao, aberto, 380, undefined, 'direita')
  useFecharFora([botao, painel], aberto, () => setAberto(false))

  const { lista, vistas, lidas } = useNotificacoes(itens)
  const novas = lista.filter((n) => !vistas.has(n.id)).length
  const naoLidas = lista.filter((n) => !lidas.has(n.id))

  const permissao = useSyncExternalStore(
    (o) => { ouvintesPermissao.add(o); return () => { ouvintesPermissao.delete(o) } },
    lerPermissao,
    () => 'sem-suporte' as Permissao,
  )

  function alternar() {
    if (!aberto) marcarVistas(lista.map((n) => n.id))
    setAberto((a) => !a)
  }

  async function pedirPermissao() {
    try { await Notification.requestPermission() } finally {
      for (const o of ouvintesPermissao) o()
    }
  }

  const grupos = new Map<string, Notificacao[]>()
  for (const n of lista) {
    const g = grupoDe(n.em)
    grupos.set(g, [...(grupos.get(g) ?? []), n])
  }

  return (
    <>
      <button
        ref={botao}
        type="button"
        onClick={alternar}
        aria-label={`Notificações${novas ? `, ${novas} novas` : ''}`}
        aria-expanded={aberto}
        className={`relative flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-padrao border bg-superficie transition-colors duration-150 hover:bg-superficie-mais-suave hover:text-tinta ${
          aberto ? 'border-marca text-tinta' : 'border-linha text-tinta-media'
        }`}
      >
        <Icone nome="sino" tamanho={19} />
        {novas > 0 ? (
          // fora do ícone, no canto, com anel da cor do fundo: o número não tampa o sino
          <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-alerta px-1.5 text-[11px] leading-none font-semibold text-white tabular-nums ring-2 ring-fundo">
            {novas > 9 ? '9+' : novas}
          </span>
        ) : null}
      </button>

      {aberto ? (
        <div
          ref={painel}
          style={{ position: 'fixed', zIndex: 70 }}
          className="flex max-h-[min(560px,calc(100vh-120px))] flex-col overflow-hidden rounded-grande border border-linha-fina bg-superficie shadow-modal"
        >
          <div className="flex shrink-0 items-center justify-between gap-3 px-5 pt-4 pb-3">
            <div className="flex flex-col">
              <span className="font-titulo text-[18px] font-semibold">Notificações</span>
              <span className="text-[12px] text-tinta-fraca">Últimos 7 dias</span>
            </div>
            {naoLidas.length > 0 ? (
              <button
                type="button"
                onClick={() => naoLidas.forEach((n) => marcarLida(n.id))}
                className="cursor-pointer rounded-padrao px-2.5 py-1.5 text-[13.5px] font-medium text-marca hover:bg-superficie-suave"
              >
                Marcar todas como lidas
              </button>
            ) : null}
          </div>

          {permissao === 'default' ? (
            <div className="mx-4 mb-2 flex items-center gap-3 rounded-media bg-positivo-superficie px-3.5 py-3">
              <span className="text-marca"><Icone nome="sino" tamanho={18} /></span>
              <span className="flex-1 text-[13.5px] leading-snug text-tinta-media">
                Receba um aviso no computador quando algo mudar, mesmo com a
                Verandi em outra aba.
              </span>
              <button
                type="button"
                onClick={pedirPermissao}
                className="shrink-0 cursor-pointer rounded-padrao bg-escuro px-3 py-2 text-[13.5px] font-medium text-tinta-clara hover:bg-escuro-hover"
              >
                Ativar
              </button>
            </div>
          ) : null}

          {lista.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 pt-6 pb-8 text-center">
              <span className="flex size-11 items-center justify-center rounded-full bg-superficie-suave text-tinta-fraca">
                <Icone nome="sino" tamanho={20} />
              </span>
              <span className="text-[14.5px] font-medium">Tudo em dia</span>
              <span className="text-[13.5px] leading-relaxed text-tinta-media">
                Cancelamentos, faltas avisadas, confirmações e remarcações
                aparecem aqui.
              </span>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
              {[...grupos.entries()].map(([grupo, doGrupo]) => (
                <section key={grupo}>
                  <p className="sticky top-0 z-10 bg-superficie px-3 pt-3 pb-1.5 text-[12px] font-semibold text-tinta-fraca">
                    {grupo}
                  </p>
                  <ul className="flex flex-col gap-0.5">
                    {doGrupo.map((n) => {
                      const lida = lidas.has(n.id)
                      return (
                        <li key={n.id}>
                          <Link
                            href={n.href}
                            onClick={() => { marcarLida(n.id); setAberto(false) }}
                            className="flex items-start gap-3 rounded-media px-3 py-3 transition-colors duration-150 hover:bg-superficie-suave"
                          >
                            <span
                              aria-hidden
                              className={`flex size-9 shrink-0 items-center justify-center rounded-full ${TIPO[n.tipo].tinta}`}
                            >
                              <Icone nome={TIPO[n.tipo].icone} tamanho={16} />
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                              <span className={`text-[14.5px] leading-snug ${lida ? 'text-tinta-media' : 'text-tinta'}`}>
                                {n.quem ? <span className="font-semibold">{n.quem} </span> : null}
                                {n.texto}
                              </span>
                              <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-tinta-fraca">
                                {n.peloBot ? (
                                  <span className="shrink-0 rounded-peca bg-positivo-fundo px-1.5 py-px font-medium text-positivo">
                                    WhatsApp
                                  </span>
                                ) : null}
                                {n.detalhe ? <span className="min-w-0 truncate">{n.detalhe}</span> : null}
                              </span>
                            </span>
                            <span className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5">
                              <span className="text-[12px] text-tinta-fraca tabular-nums">
                                {horaDe(n.em, grupo)}
                              </span>
                              {lida ? null : (
                                <span aria-label="não lida" className="size-2 rounded-full bg-marca" />
                              )}
                            </span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}

          {permissao === 'denied' ? (
            <p className="shrink-0 border-t border-linha-fina px-5 py-2.5 text-[12px] text-tinta-fraca">
              Avisos do navegador bloqueados. Para ligar, use o cadeado ao lado do endereço do site.
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  )
}
