'use client'

import Link, { useLinkStatus } from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { Icone } from './icones'
import { cliqueSimples, useTroca } from './troca'
import { CampoData } from './campo-data'
import { useFecharFora, usePosicionar } from './flutuante'

/**
 * As setas que andam no tempo: ‹ hoje › na agenda, ‹ esta semana › na grade.
 *
 * O que este componente existe para resolver **não é o layout, é o silêncio**.
 * Trocar de semana muda só o `searchParams` do mesmo segmento, e o Next mantém
 * a tela antiga renderizada durante a transição: sem `loading.tsx`, sem
 * esqueleto, sem nada. Medido no servidor de desenvolvimento: de dois a três
 * segundos e meio exibindo a semana **errada**, com a interface inteira
 * respondendo normalmente.
 *
 * Quem clica não conclui "está carregando". Conclui que o botão não funciona, e
 * clica de novo, e foi exatamente o que aconteceu.
 *
 * `useLinkStatus` só vale dentro de um `<Link>`, por isso o miolo é um
 * componente à parte.
 */
function Miolo({ children, indo = false }: { children: React.ReactNode; indo?: boolean }) {
  const { pending } = useLinkStatus()
  if (!pending && !indo) return children
  return (
    <span
      aria-hidden
      className="inline-flex size-5 items-center justify-center"
      /* o mesmo pulso do halo da próxima turma: já é o vocabulário de "espera"
         desta interface, e não introduz um segundo */
      style={{ animation: 'vd-pulsa 1s ease-in-out infinite' }}
    >
      <span className="size-2 rounded-full bg-marca" />
    </span>
  )
}

/**
 * Enquanto a próxima tela não chega, o grupo inteiro apaga um pouco.
 *
 * Só o botão clicado não bastava: a faixa de datas ao lado continua dizendo a
 * semana antiga, e é ela que a pessoa está lendo.
 */
export function NavegadorPeriodo({
  antes, meio, depois, irPara,
}: {
  antes: { href: string; rotulo: string }
  meio: { href: string; texto: string }
  depois: { href: string; rotulo: string }
  /**
   * Com isto, o botão do meio vira um menu: atalhos e uma data digitada.
   * `molde` é o endereço com `AAAA-MM-DD` no lugar da data; a página acha a
   * semana dela sozinha.
   */
  irPara?: { molde: string; modo: 'semana' | 'dia' }
}) {
  const troca = useTroca()
  const aoClicar = (href: string) => (e: React.MouseEvent) => {
    if (!troca || !cliqueSimples(e)) return
    e.preventDefault()
    troca.ir(href)
  }

  return (
    <div className="flex items-center overflow-hidden rounded-padrao border border-linha bg-superficie">
      <Link
        href={antes.href}
        // o período vizinho chega pronto: o clique só troca a tela
        prefetch
        aria-label={antes.rotulo}
        onClick={aoClicar(antes.href)}
        className="flex min-h-11 items-center px-3 text-tinta-media transition-colors duration-150 hover:bg-superficie-mais-suave"
      >
        <Miolo indo={troca?.alvo === antes.href}><Icone nome="antes" /></Miolo>
      </Link>

      {irPara ? (
        <MenuDoPeriodo meio={meio} {...irPara} />
      ) : (
        <Link
          href={meio.href}
          onClick={aoClicar(meio.href)}
          className="flex min-h-11 items-center px-3 text-[14.5px] font-medium whitespace-nowrap transition-colors duration-150 hover:bg-superficie-mais-suave"
        >
          <Miolo indo={troca?.alvo === meio.href}>{meio.texto}</Miolo>
        </Link>
      )}

      <Link
        href={depois.href}
        prefetch
        aria-label={depois.rotulo}
        onClick={aoClicar(depois.href)}
        className="flex min-h-11 items-center px-3 text-tinta-media transition-colors duration-150 hover:bg-superficie-mais-suave"
      >
        <Miolo indo={troca?.alvo === depois.href}><Icone nome="depois" /></Miolo>
      </Link>
    </div>
  )
}

/** a data de hoje no relógio de quem está olhando, em ISO */
function hojeIso(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function somar(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}

/**
 * O botão do meio como menu: atalhos e "ir para a data".
 *
 * Era um link fixo para a semana atual: em cima dela, clicar não fazia nada, e
 * parecia travado. Chegar em janeiro a partir de outubro eram quarenta cliques
 * na seta (Daniel, MGM, 13/10/2026, conferindo a presença desde o começo do
 * ano). Digitar a data leva direto: a máscara põe as barras, e a data completa
 * navega.
 */
function MenuDoPeriodo({
  meio, molde, modo,
}: {
  meio: { href: string; texto: string }
  molde: string
  modo: 'semana' | 'dia'
}) {
  const troca = useTroca()
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const botao = useRef<HTMLButtonElement>(null)
  const painel = usePosicionar(botao, aberto, 280, 280)
  useFecharFora([botao, painel], aberto, () => setAberto(false))

  const navegar = (href: string) => {
    setAberto(false)
    if (troca) troca.ir(href)
    else router.push(href)
  }
  const irData = (iso: string) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) navegar(molde.replace('AAAA-MM-DD', iso))
  }

  const hoje = hojeIso()
  const mesPassado = (() => {
    const d = new Date(`${hoje}T12:00:00`)
    d.setDate(1)
    d.setMonth(d.getMonth() - 1)
    return d.toISOString().slice(0, 10)
  })()
  const atalhos: Array<{ rotulo: string; href: string }> = [
    { rotulo: meio.texto, href: meio.href },
    modo === 'semana'
      ? { rotulo: 'Semana passada', href: molde.replace('AAAA-MM-DD', somar(hoje, -7)) }
      : { rotulo: 'Ontem', href: molde.replace('AAAA-MM-DD', somar(hoje, -1)) },
    { rotulo: 'Começo do mês passado', href: molde.replace('AAAA-MM-DD', mesPassado) },
    { rotulo: 'Começo do ano', href: molde.replace('AAAA-MM-DD', `${hoje.slice(0, 4)}-01-01`) },
  ]

  return (
    <>
      <button
        ref={botao}
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        className="flex min-h-11 cursor-pointer items-center gap-1.5 px-3 text-[14.5px] font-medium whitespace-nowrap transition-colors duration-150 hover:bg-superficie-mais-suave"
      >
        {meio.texto}
        <Icone nome="abaixo" tamanho={14} />
      </button>
      {aberto ? (
        <div
          ref={painel}
          role="dialog"
          aria-label="Escolher o período"
          style={{ position: 'fixed', zIndex: 60 }}
          className="w-[280px] rounded-grande border border-linha bg-superficie p-1.5 shadow-modal"
          onKeyDown={(e) => { if (e.key === 'Escape') setAberto(false) }}
        >
          <ul className="flex flex-col">
            {atalhos.map((a) => (
              <li key={a.rotulo}>
                <button
                  type="button"
                  onClick={() => navegar(a.href)}
                  className="flex w-full cursor-pointer items-center rounded-padrao px-2.5 py-2 text-left text-[14.5px] hover:bg-superficie-mais-suave"
                >
                  {a.rotulo}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-1.5 border-t border-linha-fina px-1.5 pt-2.5 pb-1">
            <label htmlFor="ir-para-data" className="mb-1.5 block text-[13.5px] font-medium">
              Ir para a data
            </label>
            <CampoData id="ir-para-data" nome="ir-para-data" limpavel={false} aoTrocar={irData} />
          </div>
        </div>
      ) : null}
    </>
  )
}
