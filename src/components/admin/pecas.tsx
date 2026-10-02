import Link from 'next/link'
import type { ReactNode } from 'react'
import { cartao, Etiqueta, Vazio } from '@/components/ui/pecas'
import type { EventoDoLog } from '@/server/admin/consultas'

/** O cabeçalho de toda tela do admin: título, a frase do que ela responde, e ações. */
export function CabecalhoAdmin({
  titulo, sub, children,
}: {
  titulo: ReactNode
  sub: ReactNode
  children?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-5 gap-y-3">
      <div className="min-w-0">
        <h1 className="font-titulo text-[30px] leading-[1.05] font-semibold tracking-[-.02em]">
          {titulo}
        </h1>
        <p className="pt-[3px] text-[14.5px] text-tinta-media">{sub}</p>
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2.5">{children}</div> : null}
    </header>
  )
}

const QUANDO = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit', month: '2-digit', year: '2-digit',
  hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
})

/**
 * O log em lista: quando, quem, onde e o quê.
 *
 * Uma frase por linha, no passado, com o e-mail de quem fez. O log antigo
 * mostrava o id do usuário, e id não responde "quem foi" para ninguém.
 */
export function ListaDoLog({
  eventos, semConta = false,
}: {
  eventos: EventoDoLog[]
  /** dentro da tela de uma conta, repetir o nome dela em toda linha é ruído */
  semConta?: boolean
}) {
  if (eventos.length === 0) {
    return (
      <section className={cartao}>
        <Vazio icone="lista" titulo="Nada registrado ainda"
          texto="Entradas em conta de cliente e ações da administração aparecem aqui." />
      </section>
    )
  }

  return (
    <section className={`overflow-hidden ${cartao}`}>
      <ul>
        {eventos.map((e) => (
          <li
            key={e.id}
            className="flex flex-wrap items-center gap-x-3.5 gap-y-1 border-b border-linha-fina px-4.5 py-3 last:border-b-0"
          >
            <span className="w-[124px] shrink-0 font-mono text-[12.5px] whitespace-nowrap text-tinta-media">
              {QUANDO.format(new Date(e.em))}
            </span>
            <span className="min-w-0 flex-1 basis-[240px] text-[14px] leading-[1.45]">
              <span className="font-medium">{e.quem}</span>{' '}
              <span className="text-tinta-media">{e.oQue}</span>
            </span>
            {/* a conta tem coluna própria: no meio da frase ela competia com o
                e-mail de quem fez e as duas coisas viravam um bloco só */}
            {!semConta && e.conta ? (
              e.contaId ? (
                <Link href={`/admin/contas/${e.contaId}`}
                  className="max-w-[260px] truncate text-[13.5px] font-medium underline decoration-linha underline-offset-2 hover:decoration-tinta">
                  {e.conta}
                </Link>
              ) : <span className="max-w-[260px] truncate text-[13.5px] font-medium">{e.conta}</span>
            ) : null}
            {e.emAberto ? <Etiqueta tinta="atencao">em aberto</Etiqueta> : null}
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Um número da visão geral. */
export function Numero({
  rotulo, valor, nota, href, alerta = false,
}: {
  rotulo: string
  valor: number
  nota?: string
  href?: string
  alerta?: boolean
}) {
  const corpo = (
    <>
      <span className="text-[12px] font-semibold tracking-[.1em] text-tinta-media uppercase">
        {rotulo}
      </span>
      <span className={`font-titulo text-[32px] leading-none font-semibold tracking-[-.02em] ${alerta && valor > 0 ? 'text-alerta' : ''}`}>
        {valor}
      </span>
      {nota ? <span className="text-[13px] text-tinta-media">{nota}</span> : null}
    </>
  )
  const classe = `flex flex-col gap-2 p-4.5 ${cartao}`
  return href ? (
    <Link href={href} className={`${classe} transition-colors hover:border-tinta-fraca`}>{corpo}</Link>
  ) : (
    <div className={classe}>{corpo}</div>
  )
}
