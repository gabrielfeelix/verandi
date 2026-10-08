'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import { sair } from '@/app/contas/acoes'
import { sairDoSuporte } from '@/server/suporte/acoes'
import { Icone, type NomeIcone } from './icones'
import { useFecharFora, usePosicionar } from './flutuante'
import { travarPagina, destravarPagina } from './modal'
import { Avatar } from './pecas'
import { Sino } from './sino'
import { ABRIR_SELETOR } from './seletor-de-conta'
import { useFimDaTrilha } from './fim-da-trilha'

/** O pedaço da navegação que o cabeçalho precisa para dizer onde se está. */
export type DestinoDaTrilha = { href: string; tambem?: string[]; rotulo: string }

const WHATSAPP_DA_4YU = 'https://wa.me/5544998775978'
const EMAIL_DA_4YU = 'contato@4yu.com.br'

/** As telas que moram dentro de um destino do rail, e o nome delas na trilha. */
const DENTRO: Record<string, string> = {
  '/grade': 'Grade fixa',
  '/vaga': 'Vaga',
  '/recibos': 'Recibos',
  '/aulas': 'Aulas por professor',
}

/** A tela de um registro só, aberta pelo id. */
const REGISTRO: Record<string, string> = {
  '/pessoas': 'Ficha',
  '/sessao': 'Aula',
  '/recibos': 'Recibo',
}

/** Para que serve cada destino, em uma frase: o "Nesta tela" da ajuda. */
const NESTA_TELA: Record<string, string> = {
  '/hoje': 'As aulas do dia, com quem vem em cada uma. Abra uma aula para fazer a chamada.',
  '/semana': 'A semana inteira da agenda. Abra uma aula para ver a turma e fazer a chamada. A grade fixa, que se repete toda semana, também mora aqui.',
  '/pendencias': 'Uma linha por pessoa com o que está em aberto: faltas sem reposição e o que espera decisão. "Agendar reposição" marca a aula ali mesmo.',
  '/pessoas': 'O cadastro de todos. A ficha reúne plano, contrato, aulas, faltas e reposições de cada pessoa.',
  '/financeiro': 'O que entrou, o que vence e o que está em atraso. Recibos e aulas por professor ficam aqui dentro.',
  '/config': 'Dados do estúdio, equipe, planos, horários de funcionamento e integrações.',
}

function ativoEm(caminho: string, d: Pick<DestinoDaTrilha, 'href' | 'tambem'>) {
  return [d.href, ...(d.tambem ?? [])].some((h) => caminho === h || caminho.startsWith(`${h}/`))
}

function trilhaDe(caminho: string, destinos: DestinoDaTrilha[], fim: string | null) {
  const destino = destinos.find((d) => ativoEm(caminho, d))
  if (!destino) return []
  const partes = caminho.split('/').filter(Boolean)
  const raiz = `/${partes[0] ?? ''}`
  const pedacos: Array<{ rotulo: string; href?: string }> = [{ rotulo: destino.rotulo, href: destino.href }]
  if (raiz !== destino.href && DENTRO[raiz]) pedacos.push({ rotulo: DENTRO[raiz], href: raiz })
  // o nome que a página mandou ganha do genérico: "Maria Silva", não "Ficha"
  if (partes.length > 1 && REGISTRO[raiz]) pedacos.push({ rotulo: fim ?? REGISTRO[raiz] })
  // o último é onde se está: não é link
  pedacos[pedacos.length - 1] = { rotulo: pedacos[pedacos.length - 1].rotulo }
  return pedacos
}

/**
 * O cabeçalho fixo, em cima de toda tela.
 *
 * Tira do pé do rail o que é **da pessoa e da conta**, e não de um destino:
 * perfil, ajuda, avisos, configuração. É o modelo do AutoFluxos, que o dono
 * pediu igual: à esquerda, onde se está; à direita, as portas.
 *
 * Mora no layout, como o rail: o Next mantém os dois montados entre as telas e
 * só o miolo troca.
 */
export function Cabecalho({
  destinos, pessoa, email, papel, configHref, comSino, suporte, podeTrocar, seletor,
}: {
  destinos: DestinoDaTrilha[]
  pessoa: string
  email: string
  papel: string
  /** só para quem administra a conta */
  configHref: string | null
  /** quem responde pelo negócio; a profissional não precisa do encaixe da recepção */
  comSino: boolean
  suporte: boolean
  podeTrocar: boolean
  /** no celular a conta mora aqui, porque o rail não aparece */
  seletor: ReactNode
}) {
  const caminho = usePathname()
  const [ajuda, setAjuda] = useState(false)
  const fim = useFimDaTrilha()
  const trilha = trilhaDe(caminho, destinos, fim)
  const destino = destinos.find((d) => ativoEm(caminho, d))

  return (
    // fundo sólido, sem `backdrop-blur`: o filtro vira referência do `fixed`
    // dos menus de dentro, e o menu do perfil abria deslocado pela largura do rail
    <header
      data-imprimir="fora"
      className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 border-b border-linha-suave bg-fundo px-3 md:px-6"
    >
      <div className="min-w-0 flex-1 md:hidden">{seletor}</div>

      <nav aria-label="Onde você está" className="hidden min-w-0 flex-1 items-center gap-2 text-[14.5px] md:flex">
        {trilha.map((p, i) => {
          const ultimo = i === trilha.length - 1
          return (
            <span key={`${i}-${p.rotulo}`} className={`flex items-center gap-2 ${ultimo ? 'min-w-0' : 'shrink-0'}`}>
              {i > 0 ? <span aria-hidden className="text-tinta-inativa"><Icone nome="depois" tamanho={14} /></span> : null}
              {ultimo ? (
                <span aria-current="page" className="truncate font-semibold text-tinta">{p.rotulo}</span>
              ) : (
                <Link href={p.href!} className="truncate text-tinta-media transition-colors hover:text-tinta hover:underline">
                  {p.rotulo}
                </Link>
              )}
            </span>
          )
        })}
      </nav>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <AcaoRedonda rotulo="Ajuda" icone="ajuda" aoClicar={() => setAjuda(true)} />
        {configHref ? (
          <span className="hidden md:contents">
            <AcaoRedonda rotulo="Configuração" icone="config" href={configHref} />
          </span>
        ) : null}
        {comSino ? <Sino itens={[]} noCabecalho /> : null}
        <span aria-hidden className="mx-1.5 hidden h-5 w-px bg-linha md:block" />
        <MenuDoPerfil
          pessoa={pessoa}
          email={email}
          papel={papel}
          configHref={configHref}
          suporte={suporte}
          podeTrocar={podeTrocar}
        />
      </div>

      <GavetaDeAjuda
        aberta={ajuda}
        aoFechar={() => setAjuda(false)}
        tela={destino ? { rotulo: destino.rotulo, texto: NESTA_TELA[destino.href] } : null}
      />
    </header>
  )
}

function AcaoRedonda({
  rotulo, icone, href, aoClicar,
}: { rotulo: string; icone: NomeIcone; href?: string; aoClicar?: () => void }) {
  const classe = 'flex size-10 shrink-0 items-center justify-center rounded-full text-tinta-media transition-colors duration-150 hover:bg-superficie hover:text-tinta'
  if (href) {
    return (
      <Link href={href} title={rotulo} aria-label={rotulo} className={classe}>
        <Icone nome={icone} tamanho={19} />
      </Link>
    )
  }
  return (
    <button type="button" onClick={aoClicar} title={rotulo} aria-label={rotulo} className={`${classe} cursor-pointer`}>
      <Icone nome={icone} tamanho={19} />
    </button>
  )
}

/* ------------------------------------------------------------------ perfil */

function MenuDoPerfil({
  pessoa, email, papel, configHref, suporte, podeTrocar,
}: {
  pessoa: string
  email: string
  papel: string
  configHref: string | null
  suporte: boolean
  podeTrocar: boolean
}) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [saindo, iniciar] = useTransition()
  const botao = useRef<HTMLButtonElement>(null)
  const painel = usePosicionar(botao, aberto, 300, 300, 'direita')
  useFecharFora([botao, painel], aberto, () => setAberto(false))

  const primeiro = pessoa.trim().split(/\s+/)[0] ?? pessoa

  return (
    <>
      <button
        ref={botao}
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label={`Menu de ${pessoa}`}
        className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-full p-1 transition-colors duration-150 md:pr-3 ${
          aberto ? 'bg-superficie shadow-[0_0_0_1px_var(--color-linha)]' : 'hover:bg-superficie'
        }`}
      >
        <Avatar nome={pessoa} tamanho={32} decorativo />
        <span className="hidden max-w-[140px] truncate text-[14.5px] font-medium text-tinta md:block">{primeiro}</span>
        <span className={`hidden text-tinta-fraca transition-transform duration-200 md:block ${aberto ? 'rotate-180' : ''}`}>
          <Icone nome="abaixo" tamanho={16} />
        </span>
      </button>

      {aberto ? (
        <div
          ref={painel}
          role="menu"
          aria-label="Sua conta"
          style={{ position: 'fixed', zIndex: 70, animation: 'vd-pop .2s var(--ease-pop) backwards' }}
          className="overflow-hidden rounded-grande border border-linha-fina bg-superficie shadow-modal"
        >
          <div className="flex items-center gap-3 px-4 pt-4 pb-3.5">
            <Avatar nome={pessoa} tamanho={40} decorativo />
            <div className="flex min-w-0 flex-col gap-1 leading-tight">
              <span className="truncate text-[14.5px] font-semibold">{pessoa}</span>
              <span className="truncate text-[12px] text-tinta-media">{email}</span>
              <span className="w-fit rounded-peca bg-positivo-fundo px-2 py-0.5 text-[12px] font-medium text-positivo">
                {papel}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-0.5 border-t border-linha-fina p-1.5">
            {podeTrocar ? (
              <ItemDoMenu
                icone="trocar"
                aoClicar={() => { setAberto(false); window.dispatchEvent(new Event(ABRIR_SELETOR)) }}
              >
                Trocar de organização
              </ItemDoMenu>
            ) : null}
            {configHref ? (
              <ItemDoMenu icone="config" href={configHref} aoClicar={() => setAberto(false)}>Configuração</ItemDoMenu>
            ) : null}
            {suporte ? (
              <ItemDoMenu icone="chave" href="/admin" aoClicar={() => setAberto(false)}>Administração</ItemDoMenu>
            ) : null}
            <ItemDoMenu icone="cadeado" href="/esqueci" aoClicar={() => setAberto(false)}>Redefinir senha</ItemDoMenu>
          </div>

          <div className="border-t border-linha-fina p-1.5">
            {suporte ? (
              <ItemDoMenu
                icone="sair"
                aoClicar={() => iniciar(async () => {
                  await sairDoSuporte()
                  router.push('/admin/empresas')
                })}
              >
                {saindo ? 'Saindo…' : 'Sair do suporte'}
              </ItemDoMenu>
            ) : (
              <form action={sair}>
                <ItemDoMenu icone="sair" enviar>Sair</ItemDoMenu>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}

function ItemDoMenu({
  icone, href, aoClicar, enviar, children,
}: { icone: NomeIcone; href?: string; aoClicar?: () => void; enviar?: boolean; children: ReactNode }) {
  const classe = 'flex min-h-10 w-full cursor-pointer items-center gap-3 rounded-media px-2.5 text-left text-[14.5px] text-tinta transition-colors duration-150 hover:bg-superficie-suave'
  const conteudo = (
    <>
      <span className="text-tinta-media"><Icone nome={icone} tamanho={18} /></span>
      {children}
    </>
  )
  if (href) {
    return <Link role="menuitem" href={href} onClick={aoClicar} className={classe}>{conteudo}</Link>
  }
  return (
    <button role="menuitem" type={enviar ? 'submit' : 'button'} onClick={aoClicar} className={classe}>
      {conteudo}
    </button>
  )
}

/* ------------------------------------------------------------------- ajuda */

/**
 * A ajuda abre de lado, sem tirar a pessoa da tela, como no AutoFluxos: a
 * dúvida aparece no meio do trabalho, e trocar de página para tirá-la é perder
 * o que estava aberto.
 */
function GavetaDeAjuda({
  aberta, aoFechar, tela,
}: {
  aberta: boolean
  aoFechar: () => void
  tela: { rotulo: string; texto?: string } | null
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (aberta && !d.open) d.showModal()
    if (!aberta && d.open) d.close()
    if (!aberta) return
    travarPagina()
    return destravarPagina
  }, [aberta])

  return (
    <dialog
      ref={ref}
      aria-labelledby="titulo-da-ajuda"
      onClose={aoFechar}
      onClick={(e) => { if (e.target === ref.current) aoFechar() }}
      className="m-0 ml-auto h-dvh max-h-none w-full max-w-[400px] bg-transparent p-0 backdrop:bg-escuro/42 backdrop:backdrop-blur-[3px] md:p-3"
    >
      <div
        className="flex h-full flex-col overflow-y-auto bg-superficie shadow-modal md:rounded-modal"
        style={{ animation: aberta ? 'vd-gaveta .32s var(--ease-espacial) backwards' : undefined }}
      >
        <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-2">
          <div>
            <h2 id="titulo-da-ajuda" className="font-titulo text-[22px] font-semibold tracking-[-.02em]">
              Precisa de ajuda?
            </h2>
            <p className="pt-1 text-[13.5px] text-tinta-media">A equipe da 4YU responde por aqui.</p>
          </div>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar a ajuda"
            className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-padrao text-tinta-media hover:bg-superficie-suave hover:text-tinta"
          >
            <Icone nome="fechar" tamanho={18} />
          </button>
        </div>

        {tela?.texto ? (
          <section className="mx-6 mt-4 rounded-grande bg-positivo-superficie px-4 py-3.5">
            <p className="text-[12px] font-semibold text-marca">Nesta tela: {tela.rotulo}</p>
            <p className="pt-1 text-[13.5px] leading-relaxed text-tinta-media">{tela.texto}</p>
          </section>
        ) : null}

        <div className="flex flex-col gap-2 px-6 pt-5">
          <PortaDeAjuda
            icone="whatsapp"
            titulo="Falar no WhatsApp"
            texto="Dúvida, erro ou pedido: mande mensagem para a 4YU."
            href={WHATSAPP_DA_4YU}
          />
          <PortaDeAjuda
            icone="email"
            titulo="Mandar e-mail"
            texto={EMAIL_DA_4YU}
            href={`mailto:${EMAIL_DA_4YU}`}
          />
        </div>

        <p className="mt-auto flex gap-4 px-6 pt-8 pb-6 text-[12px] text-tinta-fraca">
          <Link href="/termos" className="hover:text-tinta hover:underline">Termos de uso</Link>
          <Link href="/privacidade" className="hover:text-tinta hover:underline">Privacidade</Link>
        </p>
      </div>
    </dialog>
  )
}

function PortaDeAjuda({
  icone, titulo, texto, href,
}: { icone: NomeIcone; titulo: string; texto: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3.5 rounded-grande border border-linha-suave px-4 py-3.5 transition-colors duration-150 hover:border-marca hover:bg-superficie-tenue"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-positivo-fundo text-marca">
        <Icone nome={icone} tamanho={19} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="text-[14.5px] font-semibold">{titulo}</span>
        <span className="truncate pt-0.5 text-[12px] text-tinta-media">{texto}</span>
      </span>
      <span className="text-tinta-fraca"><Icone nome="depois" tamanho={16} /></span>
    </a>
  )
}
