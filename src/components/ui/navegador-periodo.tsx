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
   * Pular direto para uma data. `molde` é o endereço com `AAAA-MM-DD` no lugar
   * da data; a página acha a semana dela sozinha.
   */
  irPara?: { molde: string }
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

      <Link
        href={meio.href}
        onClick={aoClicar(meio.href)}
        className="flex min-h-11 items-center px-3 text-[14.5px] font-medium whitespace-nowrap transition-colors duration-150 hover:bg-superficie-mais-suave"
      >
        <Miolo indo={troca?.alvo === meio.href}>{meio.texto}</Miolo>
      </Link>

      <Link
        href={depois.href}
        prefetch
        aria-label={depois.rotulo}
        onClick={aoClicar(depois.href)}
        className="flex min-h-11 items-center px-3 text-tinta-media transition-colors duration-150 hover:bg-superficie-mais-suave"
      >
        <Miolo indo={troca?.alvo === depois.href}><Icone nome="depois" /></Miolo>
      </Link>

      {irPara ? <IrParaData {...irPara} /> : null}
    </div>
  )
}

/**
 * O calendário ao lado das setas.
 *
 * Chegar em janeiro a partir de outubro eram quarenta cliques na seta (Daniel,
 * MGM, 13/10/2026, conferindo a presença de cada aluno desde o começo do ano).
 * Digitar a data já leva: a máscara põe as barras, e a data completa navega.
 */
function IrParaData({ molde }: { molde: string }) {
  const troca = useTroca()
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const botao = useRef<HTMLButtonElement>(null)
  const painel = usePosicionar(botao, aberto, 280, 280, 'direita')
  useFecharFora([botao, painel], aberto, () => setAberto(false))

  const ir = (iso: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return
    setAberto(false)
    const href = molde.replace('AAAA-MM-DD', iso)
    if (troca) troca.ir(href)
    else router.push(href)
  }

  return (
    <>
      <button
        ref={botao}
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-label="Ir para uma data"
        aria-expanded={aberto}
        className="flex min-h-11 cursor-pointer items-center border-l border-linha px-3 text-tinta-media transition-colors duration-150 hover:bg-superficie-mais-suave hover:text-tinta"
      >
        <Icone nome="hoje" tamanho={18} />
      </button>
      {aberto ? (
        <div
          ref={painel}
          style={{ position: 'fixed', zIndex: 60 }}
          className="w-[280px] rounded-grande border border-linha bg-superficie p-3 shadow-modal"
          onKeyDown={(e) => { if (e.key === 'Escape') setAberto(false) }}
        >
          <label htmlFor="ir-para-data" className="mb-1.5 block text-[13.5px] font-medium">
            Ir para a data
          </label>
          <CampoData
            id="ir-para-data"
            nome="ir-para-data"
            limpavel={false}
            autoFocus
            aoTrocar={ir}
          />
        </div>
      ) : null}
    </>
  )
}
