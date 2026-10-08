'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import type { Papel } from '@/core/acesso/destino'
import { contasDoSuporte, trocarDeConta, type ContaParaTrocar } from '@/server/suporte/troca'
import { Icone } from './icones'
import { useFecharFora, usePosicionar } from './flutuante'
import { tileDe } from './tile-da-conta'

export type ContaDoSeletor = { contaId: string; nome: string; papel: string }

/** O evento que o menu do perfil dispara para abrir este seletor. */
export const ABRIR_SELETOR = 'verandi:abrir-seletor'

/**
 * A tela que continua valendo na conta nova.
 *
 * Trocar de empresa **mantém a seção**: da Agenda de uma para a Agenda da
 * outra, que é o que quem atende várias faz o dia inteiro. O que não atravessa
 * é o que tem id (a ficha de uma aluna não existe na outra conta) e o que o
 * papel novo não abre.
 */
function destinoNaOutra(caminho: string, papel: Papel): string {
  const partes = caminho.split('/').filter(Boolean)
  const raiz = `/${partes[0] ?? 'hoje'}`
  // vindo da administração não há seção para manter: abre a agenda
  if (raiz === '/admin') return '/semana'
  // a aula aberta é da agenda: volta para a semana, não para `/sessao`
  const alvo = partes.length > 1 ? (raiz === '/sessao' ? '/semana' : raiz) : raiz
  if (papel === 'profissional' && alvo !== '/hoje' && alvo !== '/semana') return '/hoje'
  if (papel === 'recepcao' && alvo === '/config') return '/semana'
  return alvo
}

function Tile({ nome, tamanho = 32 }: { nome: string; tamanho?: number }) {
  const { fundo, frente, sigla } = tileDe(nome)
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full font-semibold tracking-[-.02em]"
      style={{ width: tamanho, height: tamanho, background: fundo, color: frente, fontSize: tamanho * 0.4 }}
    >
      {sigla}
    </span>
  )
}

/**
 * A empresa atual no topo do rail, logo abaixo da marca, e a troca para as
 * outras sem sair da tela.
 *
 * Era um "trocar" sublinhado no pé do rail que levava a `/contas`: tela
 * inteira, e a pessoa caía no começo da outra empresa, longe de onde estava. O
 * modelo é o do AutoFluxos, que o dono pediu igual.
 *
 * Para o suporte a lista é a das empresas clientes, com busca, porque ele não
 * é membro de nenhuma: entrar por aqui registra o acesso do mesmo jeito que o
 * "Entrar" da administração.
 */
export function SeletorDeConta({
  atual, contas, suporte, compacto = false, claro = false,
}: {
  atual: ContaDoSeletor
  /** as contas de que a pessoa é membro; o suporte busca as dele */
  contas: ContaDoSeletor[]
  suporte: boolean
  /** rail fechado: só a sigla */
  compacto?: boolean
  /** no cabeçalho do celular, sobre fundo claro */
  claro?: boolean
}) {
  const router = useRouter()
  const caminho = usePathname()
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const [achadas, setAchadas] = useState<ContaParaTrocar[] | null>(null)
  const [indo, setIndo] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [, iniciar] = useTransition()
  const botao = useRef<HTMLButtonElement>(null)
  const painel = usePosicionar(botao, aberto, 300)
  useFecharFora([botao, painel], aberto, () => setAberto(false))

  const outras = contas.filter((c) => c.contaId !== atual.contaId)
  const podeTrocar = suporte || outras.length > 0

  // o menu do perfil abre este seletor, em vez de ter uma lista própria
  useEffect(() => {
    if (!podeTrocar) return
    // há um seletor no rail e outro no cabeçalho do celular: abre o que se vê
    const abrir = () => { if (botao.current?.offsetParent) setAberto(true) }
    window.addEventListener(ABRIR_SELETOR, abrir)
    return () => window.removeEventListener(ABRIR_SELETOR, abrir)
  }, [podeTrocar])

  // a busca do suporte espera a pessoa parar de digitar
  useEffect(() => {
    if (!aberto || !suporte) return
    let vivo = true
    const t = window.setTimeout(() => {
      contasDoSuporte(busca).then((lista) => { if (vivo) setAchadas(lista) }).catch(() => {
        if (vivo) setAchadas([])
      })
    }, busca ? 250 : 0)
    return () => { vivo = false; window.clearTimeout(t) }
  }, [aberto, suporte, busca])

  function ir(contaId: string) {
    setIndo(contaId)
    setErro(null)
    iniciar(async () => {
      try {
        const { papel } = await trocarDeConta(contaId)
        setAberto(false)
        router.push(destinoNaOutra(caminho, papel))
        router.refresh()
      } catch {
        setErro('Não deu para abrir essa conta. Tente de novo.')
      } finally {
        setIndo(null)
      }
    })
  }

  const identificacao = (
    <>
      <Tile nome={atual.nome} tamanho={compacto ? 34 : 30} />
      {compacto ? null : (
        <span className="flex min-w-0 flex-1 flex-col text-left leading-tight">
          <span className={`truncate text-[13.5px] font-semibold ${claro ? 'text-tinta' : 'text-tinta-clara'}`}>
            {atual.nome}
          </span>
          <span className={`truncate text-[12px] ${claro ? 'text-tinta-media' : 'text-tinta-escura-fraca'}`}>
            {atual.papel}
          </span>
        </span>
      )}
    </>
  )

  // conta única: nada para trocar, e um botão que abre lista de um item é atrito
  if (!podeTrocar) {
    return (
      <div title={atual.nome} className={`flex items-center gap-2.5 ${compacto ? 'justify-center' : 'px-2 py-1.5'}`}>
        {identificacao}
      </div>
    )
  }

  const lista: Array<{ contaId: string; nome: string; detalhe: string; suspensa?: boolean }> = suporte
    ? (achadas ?? []).map((c) => ({
        contaId: c.contaId, nome: c.nome, detalhe: 'Entrar como suporte', suspensa: !c.ativa,
      }))
    : contas.map((c) => ({ contaId: c.contaId, nome: c.nome, detalhe: c.papel }))

  return (
    <>
      <button
        ref={botao}
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        title={`${atual.nome}: trocar de organização`}
        className={`group flex w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-media border transition-colors duration-150 ${
          compacto ? 'justify-center p-1' : 'px-2 py-1.5'
        } ${
          claro
            ? 'border-transparent hover:bg-superficie-mais-suave'
            : aberto ? 'border-white/12 bg-white/7' : 'border-transparent hover:border-white/12 hover:bg-white/7'
        }`}
      >
        {identificacao}
        {compacto ? null : (
          <span className={`shrink-0 ${claro ? 'text-tinta-fraca' : 'text-tinta-escura-fraca group-hover:text-tinta-clara'}`}>
            <Icone nome="seletor" tamanho={16} />
          </span>
        )}
      </button>

      {aberto ? (
        <div
          ref={painel}
          role="dialog"
          aria-label="Trocar de organização"
          style={{ position: 'fixed', zIndex: 70, animation: 'vd-pop .2s var(--ease-pop) backwards' }}
          className="flex max-h-[min(480px,calc(100dvh-96px))] flex-col overflow-hidden rounded-grande border border-linha-fina bg-superficie text-tinta shadow-modal"
        >
          <p className="shrink-0 px-4 pt-3.5 pb-2 text-[12px] font-semibold text-tinta-fraca">
            Trocar de organização
          </p>

          {suporte ? (
            <label className="mx-3 mb-2 flex shrink-0 items-center gap-2 rounded-padrao border border-linha bg-superficie-suave px-3 focus-within:border-marca">
              <span className="text-tinta-fraca"><Icone nome="busca" tamanho={16} /></span>
              <input
                autoFocus
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar empresa"
                aria-label="Buscar empresa"
                className="min-h-10 min-w-0 flex-1 bg-transparent text-[14.5px] outline-none placeholder:text-tinta-inativa"
              />
            </label>
          ) : null}

          <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
            {suporte && achadas === null ? (
              [0, 1, 2].map((i) => (
                <li key={i} className="flex items-center gap-3 px-2 py-2.5">
                  <span className="size-8 shrink-0 animate-pulse rounded-padrao bg-superficie-mais-suave" />
                  <span className="h-3.5 w-36 animate-pulse rounded-peca bg-superficie-mais-suave" />
                </li>
              ))
            ) : lista.length === 0 ? (
              <li className="px-3 py-6 text-center text-[13.5px] text-tinta-media">
                Nenhuma empresa com esse nome.
              </li>
            ) : (
              lista.map((c) => {
                const ehAtual = c.contaId === atual.contaId
                return (
                  <li key={c.contaId}>
                    <button
                      type="button"
                      disabled={ehAtual || indo !== null}
                      onClick={() => ir(c.contaId)}
                      aria-current={ehAtual ? 'true' : undefined}
                      className={`flex w-full items-center gap-3 rounded-media px-2 py-2 text-left transition-colors duration-150 ${
                        ehAtual ? 'bg-positivo-superficie' : 'hover:bg-superficie-suave disabled:opacity-60'
                      }`}
                    >
                      <Tile nome={c.nome} />
                      <span className="flex min-w-0 flex-1 flex-col leading-tight">
                        <span className="truncate text-[14.5px] font-medium">{c.nome}</span>
                        <span className="truncate text-[12px] text-tinta-media">
                          {indo === c.contaId ? 'Abrindo…' : c.suspensa ? 'Suspensa' : ehAtual ? 'Você está aqui' : c.detalhe}
                        </span>
                      </span>
                      {ehAtual ? <span className="text-marca"><Icone nome="check" tamanho={18} /></span> : null}
                    </button>
                  </li>
                )
              })
            )}
          </ul>

          {erro ? (
            <p role="alert" className="mx-3 mb-2 rounded-padrao bg-alerta-superficie px-3 py-2 text-[13.5px] text-alerta-texto">
              {erro}
            </p>
          ) : null}

          {suporte ? (
            <Link
              href="/admin/empresas"
              onClick={() => setAberto(false)}
              className="flex shrink-0 items-center justify-between border-t border-linha-fina px-4 py-3 text-[13.5px] font-medium text-marca hover:bg-superficie-suave"
            >
              Todas as empresas na administração
              <Icone nome="depois" tamanho={16} />
            </Link>
          ) : null}
        </div>
      ) : null}
    </>
  )
}
