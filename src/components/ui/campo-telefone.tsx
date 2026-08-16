'use client'

import { useState } from 'react'
import { erroDoTelefone, mascararTelefone } from '@/core/telefone'

/**
 * Telefone com o DDD cobrado na hora, não no dia de avisar alguém.
 *
 * A máscara escreve os parênteses e o traço sozinha, e o aviso só aparece
 * quando o campo perde o foco — cobrar o DDD na segunda tecla digitada é
 * discutir com quem ainda está escrevendo.
 */
export function CampoTelefone({
  nome = 'telefone', valorInicial = '', id, autoFocus = false,
}: {
  nome?: string
  valorInicial?: string
  id?: string
  autoFocus?: boolean
}) {
  const [texto, setTexto] = useState(mascararTelefone(valorInicial))
  const [tocado, setTocado] = useState(false)
  const erro = tocado ? erroDoTelefone(texto) : null

  return (
    <>
      <input
        id={id}
        name={nome}
        value={texto}
        autoFocus={autoFocus}
        onChange={(e) => setTexto(mascararTelefone(e.target.value))}
        onBlur={() => setTocado(true)}
        type="tel"
        inputMode="tel"
        placeholder="(44) 99999-9999"
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? `${id ?? nome}-erro` : undefined}
        className={`campo w-full ${erro ? 'border-alerta-linha-forte bg-alerta-superficie' : ''}`}
      />
      {erro ? (
        <span id={`${id ?? nome}-erro`} className="text-[12px] text-alerta">
          {erro}
        </span>
      ) : null}
    </>
  )
}
