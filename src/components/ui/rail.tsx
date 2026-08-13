'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSyncExternalStore } from 'react'

export type ItemRail = {
  href: string
  /** o nome por extenso: vira `title` e leitura de leitor de tela */
  rotulo: string
  /** o nome curto, que é o que cabe embaixo do glifo quando o rail está fechado */
  curto: string
  glifo: string
  /** número em laranja; `0` não desenha nada, porque zero não é pendência */
  badge?: number
}

const CHAVE = 'verandi:rail-aberto'

/*
 * O rail aberto ou fechado é estado do navegador, não do React — por isso ele é
 * lido com `useSyncExternalStore` em vez de um efeito que copia `localStorage`
 * para dentro de um `useState`. O servidor sempre responde "aberto"; o cliente
 * corrige na hidratação, sem render em cascata e sem piscar duas vezes.
 */
const ouvintes = new Set<() => void>()

function assinarRail(avisar: () => void) {
  ouvintes.add(avisar)
  return () => {
    ouvintes.delete(avisar)
  }
}

/**
 * Fechado é o padrão, como no protótipo: a tela de trabalho é densa, e o rótulo
 * curto embaixo do glifo já diz onde se clica. Quem abre, abre uma vez.
 */
function lerRail() {
  return window.localStorage.getItem(CHAVE) === 'sim'
}

function gravarRail(aberto: boolean) {
  window.localStorage.setItem(CHAVE, aberto ? 'sim' : 'nao')
  ouvintes.forEach((avisar) => avisar())
}

/** A rota está ativa quando é ela ou uma filha dela (`/pessoas/123`). */
function ativoEm(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * O rail escuro do protótipo: navegação em pé, do lado esquerdo, que encolhe
 * para caber mais tela.
 *
 * Fechado ele continua mostrando o rótulo curto embaixo do glifo — ícone sozinho
 * com nove destinos vira adivinhação, e quem opera não deveria ter que passar o
 * mouse para descobrir onde clica.
 */
export function Rail({
  itens, conta, pessoa, papel, podeTrocar, sair,
}: {
  itens: ItemRail[]
  conta: string
  pessoa: string
  papel: string
  podeTrocar: boolean
  sair: React.ReactNode
}) {
  const pathname = usePathname()
  // a preferência é do dispositivo, não da conta: mesma pessoa, telas diferentes
  const aberto = useSyncExternalStore(assinarRail, lerRail, () => false)

  return (
    // o `aside` acompanha a altura da página para o escuro não terminar no meio
    // do rolar; o conteúdo dele é que fica preso no topo
    <aside
      style={{ width: aberto ? 212 : 68 }}
      className="hidden shrink-0 self-stretch bg-escuro transition-[width] duration-200 md:block"
    >
      <div className="sticky top-0 flex h-dvh flex-col gap-5 px-3 py-4">
      <div className="flex items-center gap-3 pl-1">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[12px] bg-menta font-titulo text-[19px] font-bold text-escuro">
          V
        </span>
        {aberto ? (
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="font-titulo text-[16px] font-semibold text-tinta-clara">
              Verandi
            </span>
            <span className="truncate font-mono text-[9.5px] tracking-[.12em] text-tinta-fraca uppercase">
              {conta}
            </span>
          </span>
        ) : null}
      </div>

      <nav aria-label="Navegação principal" className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {itens.map((i) => {
          const ativo = ativoEm(pathname, i.href)
          return (
            <Link
              key={i.href}
              href={i.href}
              title={i.rotulo}
              aria-current={ativo ? 'page' : undefined}
              className={`relative flex items-center rounded-[14px] transition-colors duration-200 ${
                aberto
                  ? 'min-h-10 flex-row gap-3 px-3'
                  : 'min-h-13 flex-col justify-center gap-0.5 px-1 py-1.5'
              } ${
                ativo
                  ? 'bg-menta/15 text-menta'
                  : 'text-[#8FA8A0] hover:bg-white/8 hover:text-tinta-clara'
              }`}
            >
              <span aria-hidden className="flex size-5 shrink-0 items-center justify-center">
                {i.glifo}
              </span>
              <span
                className={
                  aberto
                    ? 'min-w-0 flex-1 truncate text-[13.5px]'
                    : 'text-[8px] tracking-[.06em] uppercase'
                }
              >
                {aberto ? i.rotulo : i.curto}
              </span>
              {i.badge ? (
                <span
                  className={`flex h-[18px] min-w-[19px] items-center justify-center rounded-[9px] bg-[#F0693C] px-1.5 text-[10px] font-semibold text-white ${
                    aberto ? 'ml-auto' : 'absolute top-1 right-1'
                  }`}
                >
                  {i.badge}
                  <span className="sr-only"> esperando decisão</span>
                </span>
              ) : null}
            </Link>
          )
        })}
      </nav>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => gravarRail(!aberto)}
          aria-expanded={aberto}
          className="flex min-h-10 items-center gap-3 rounded-[12px] px-3 text-[#8FA8A0] hover:bg-white/8 hover:text-tinta-clara"
        >
          <span
            aria-hidden
            className="inline-block w-6 shrink-0 text-center font-mono text-[16px] transition-transform duration-300"
            style={{ transform: `rotate(${aberto ? 180 : 0}deg)` }}
          >
            ›
          </span>
          <span className={aberto ? 'text-[12.5px] whitespace-nowrap' : 'sr-only'}>
            {aberto ? 'Retrair menu' : 'Expandir menu'}
          </span>
        </button>

        <div
          className={`flex items-center gap-3 rounded-[14px] p-1.5 ${
            aberto ? '' : 'flex-col'
          }`}
        >
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#2F4A40] text-[11.5px] font-semibold text-[#BFEBDD] ring-2 ring-menta"
          >
            {iniciais(pessoa)}
          </span>
          {aberto ? (
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-[12.5px] text-tinta-clara">{pessoa}</span>
              <span className="text-[10.5px] text-[#8FA8A0]">
                {papel}
                {podeTrocar ? (
                  <>
                    {' · '}
                    <Link href="/contas" className="text-menta underline">
                      trocar
                    </Link>
                  </>
                ) : null}
              </span>
            </span>
          ) : null}
          {aberto ? sair : null}
        </div>
        {aberto ? null : <div className="flex justify-center">{sair}</div>}
        </div>
      </div>
    </aside>
  )
}

/**
 * A barra de baixo, que é o rail em tela estreita.
 *
 * Quatro destinos, não nove: em celular quem usa é o profissional em pé na sala,
 * e o resto se alcança pelas telas.
 */
export function BarraInferior({ itens }: { itens: ItemRail[] }) {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-linha bg-superficie px-2 pt-2 pb-2.5 md:hidden"
    >
      {itens.map((i) => {
        const ativo = ativoEm(pathname, i.href)
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={ativo ? 'page' : undefined}
            className={`relative flex min-h-13 flex-1 flex-col items-center justify-center gap-1 rounded-[13px] ${
              ativo ? 'bg-superficie-mais-suave text-marca' : 'text-tinta-media'
            }`}
          >
            <span aria-hidden className="flex size-5 items-center justify-center">
              {i.glifo}
            </span>
            <span className="text-[10px] font-medium">{i.curto}</span>
            {i.badge ? (
              <span className="absolute top-1 right-3 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-[#F0693C] px-1 text-[9px] font-semibold text-white">
                {i.badge}
              </span>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/)
  return ((partes[0]?.[0] ?? '?') + (partes[1]?.[0] ?? '')).toUpperCase()
}
