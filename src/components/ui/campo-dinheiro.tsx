'use client'

import { useState } from 'react'
import { entrada } from './pecas'

/**
 * Campo de valor em reais: "R$" dentro do campo e a máscara enquanto digita.
 *
 * Os dígitos entram pela direita, como numa maquininha: 4, 45, 450, 4.500,
 * 45.000,00. Ninguém precisa digitar vírgula, e o texto que sai é o que
 * `emCentavos` (`core/planos/plano.ts`) já sabe ler.
 */
export function formatarReais(digitos: string): string {
  const so = digitos.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 11)
  if (!so) return ''
  const cent = so.padStart(3, '0')
  const inteiro = cent.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${inteiro},${cent.slice(-2)}`
}

export function CampoDinheiro({
  id, valor, aoMudar, nome, valorInicial, required, disabled = false, placeholder = '0,00',
}: {
  id?: string
  /** controlado: o texto já formatado ("45.000,00"), ou vazio */
  valor?: string
  aoMudar?: (texto: string) => void
  /** em formulário (`FormData`): o nome do campo */
  nome?: string
  /** em formulário: o valor de partida, em qualquer formato ("R$ 1.980,00", "45,5") */
  valorInicial?: string
  required?: boolean
  disabled?: boolean
  placeholder?: string
}) {
  const [proprio, setProprio] = useState(() => formatarReais(
    // "45,5" vira 45,50 e não 4,55: completa os centavos antes de mascarar
    (valorInicial ?? '').replace(/,(\d)$/, ',$10'),
  ))
  const texto = valor ?? proprio
  return (
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[14.5px] text-tinta-media"
      >
        R$
      </span>
      <input
        id={id}
        inputMode="numeric"
        name={nome}
        required={required}
        value={texto}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => {
          const novo = formatarReais(e.target.value)
          if (aoMudar) aoMudar(novo)
          else setProprio(novo)
        }}
        className={`${entrada} pl-10 tabular-nums disabled:opacity-50`}
      />
    </div>
  )
}
