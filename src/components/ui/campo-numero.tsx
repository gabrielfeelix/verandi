'use client'

import { useState } from 'react'

/**
 * Número que só aceita número.
 *
 * `<input type="number">` parece resolver e não resolve: o navegador aceita
 * `e`, `+`, `-` e `.` porque o tipo existe para notação científica também. Deu
 * para digitar "50e2" na duração de uma aula, e o campo não reclamou — 50e2 é
 * cinco mil, e nenhuma aula dura cinco mil minutos.
 *
 * Aqui entra dígito e mais nada. Sem setinhas, que em campo de 24px são alvo
 * que ninguém acerta, e com teclado numérico no celular.
 */
export function CampoNumero({
  nome, valorInicial, id, min = 1, max, sufixo, className = '', required = false,
}: {
  nome: string
  valorInicial?: number | string
  id?: string
  min?: number
  max?: number
  /** "min", "vagas": aparece dentro do campo, do lado direito */
  sufixo?: string
  className?: string
  required?: boolean
}) {
  const [texto, setTexto] = useState(String(valorInicial ?? ''))

  return (
    <span className="campo-caixa flex items-center gap-2 px-3.5">
      <input
        id={id}
        name={nome}
        value={texto}
        onChange={(e) => setTexto(e.target.value.replace(/\D/g, ''))}
        onBlur={() => {
          if (texto === '') return
          const n = Number(texto)
          if (n < min) setTexto(String(min))
          if (max !== undefined && n > max) setTexto(String(max))
        }}
        inputMode="numeric"
        // o teclado do celular vem numérico, e o navegador ainda cobra o campo
        // vazio quando ele é obrigatório
        pattern="[0-9]*"
        required={required}
        className={`min-w-0 flex-1 bg-transparent py-3 text-[15px] outline-none ${className}`}
      />
      {sufixo ? (
        <span aria-hidden className="shrink-0 text-[13.5px] text-tinta-fraca">
          {sufixo}
        </span>
      ) : null}
    </span>
  )
}
