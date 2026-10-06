'use client'

import Link from 'next/link'
import { useId, useRef, useState } from 'react'
import { Icone } from './icones'
import { useFecharFora, usePosicionar } from './flutuante'

/**
 * Filtro de poucas opções num menu suspenso, com cara de chip.
 *
 * Serve ao filtro raro (local, sala): três chips à vista para algo que se usa
 * uma vez por semana empurravam o filtro frequente para fora da tela. Cada
 * opção é um link, porque o filtro mora na URL, como os chips ao lado.
 *
 * O painel é `fixed`: a faixa de filtros rola de lado no celular, e um painel
 * absoluto seria cortado por ela.
 */
export function Suspenso({
  rotulo, ativo, itens,
}: {
  rotulo: string
  ativo: boolean
  itens: Array<{ rotulo: string; href: string; ativo: boolean }>
}) {
  const [aberto, setAberto] = useState(false)
  const gatilho = useRef<HTMLButtonElement>(null)
  const painel = usePosicionar(gatilho, aberto, 200)
  const id = useId()
  useFecharFora([gatilho, painel], aberto, () => setAberto(false))

  return (
    <>
      <button
        ref={gatilho}
        type="button"
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={aberto ? id : undefined}
        onClick={() => setAberto((v) => !v)}
        className={`inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[14.5px] transition-colors duration-150 ${
          ativo
            ? 'border-escuro bg-escuro font-medium text-tinta-clara'
            : 'border-linha bg-superficie text-tinta-media hover:bg-superficie-mais-suave'
        }`}
      >
        {rotulo}
        <Icone nome="abaixo" tamanho={14} />
      </button>

      {aberto ? (
        <div
          ref={painel}
          id={id}
          role="menu"
          className="z-[25] flex flex-col gap-0.5 rounded-grande border border-linha-suave bg-superficie p-1.5 shadow-elevado"
          style={{ animation: 'vd-pop .18s ease both' }}
        >
          {itens.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              role="menuitem"
              aria-current={i.ativo ? 'true' : undefined}
              onClick={() => setAberto(false)}
              className={`flex min-h-10 items-center justify-between gap-2.5 rounded-peca px-2.5 text-[14.5px] transition-colors duration-150 hover:bg-superficie-suave ${
                i.ativo ? 'font-medium text-tinta' : 'text-tinta-media'
              }`}
            >
              {i.rotulo}
              {i.ativo ? <Icone nome="check" tamanho={16} /> : null}
            </Link>
          ))}
        </div>
      ) : null}
    </>
  )
}
