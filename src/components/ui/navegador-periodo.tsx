'use client'

import Link, { useLinkStatus } from 'next/link'
import { Icone } from './icones'

/**
 * As setas que andam no tempo: ‹ hoje › na agenda, ‹ esta semana › na grade.
 *
 * O que este componente existe para resolver **não é o layout, é o silêncio**.
 * Trocar de semana muda só o `searchParams` do mesmo segmento, e o Next mantém
 * a tela antiga renderizada durante a transição — sem `loading.tsx`, sem
 * esqueleto, sem nada. Medido no servidor de desenvolvimento: de dois a três
 * segundos e meio exibindo a semana **errada**, com a interface inteira
 * respondendo normalmente.
 *
 * Quem clica não conclui "está carregando". Conclui que o botão não funciona, e
 * clica de novo — foi exatamente o que aconteceu.
 *
 * `useLinkStatus` só vale dentro de um `<Link>`, por isso o miolo é um
 * componente à parte.
 */
function Miolo({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus()
  if (!pending) return children
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
  antes, meio, depois,
}: {
  antes: { href: string; rotulo: string }
  meio: { href: string; texto: string }
  depois: { href: string; rotulo: string }
}) {
  return (
    <div className="flex items-center overflow-hidden rounded-padrao border border-linha bg-superficie">
      <Link
        href={antes.href}
        aria-label={antes.rotulo}
        className="flex min-h-11 items-center px-3 text-tinta-media transition-colors duration-150 hover:bg-superficie-mais-suave"
      >
        <Miolo><Icone nome="antes" /></Miolo>
      </Link>

      <Link
        href={meio.href}
        className="flex min-h-11 items-center px-3 text-[13px] font-medium whitespace-nowrap transition-colors duration-150 hover:bg-superficie-mais-suave"
      >
        <Miolo>{meio.texto}</Miolo>
      </Link>

      <Link
        href={depois.href}
        aria-label={depois.rotulo}
        className="flex min-h-11 items-center px-3 text-tinta-media transition-colors duration-150 hover:bg-superficie-mais-suave"
      >
        <Miolo><Icone nome="depois" /></Miolo>
      </Link>
    </div>
  )
}
