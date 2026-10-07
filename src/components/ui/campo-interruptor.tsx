'use client'

import { useState } from 'react'
import { Interruptor } from './interruptor'

/**
 * A alavanca da casa dentro de um formulário, no lugar do checkbox do sistema.
 * O valor viaja num campo escondido (`on` ou vazio), e quem salva continua
 * lendo o `FormData` como lia o checkbox.
 */
export function CampoInterruptor({
  nome, rotulo, inicial = false,
}: {
  nome: string
  rotulo: string
  inicial?: boolean
}) {
  const [ligado, setLigado] = useState(inicial)
  return (
    <div className="flex items-center gap-2.5">
      <input type="hidden" name={nome} value={ligado ? 'on' : ''} />
      <Interruptor ligado={ligado} aoMudar={setLigado} rotulo={rotulo} />
      <span aria-hidden className="text-[14.5px]">{rotulo}</span>
    </div>
  )
}
