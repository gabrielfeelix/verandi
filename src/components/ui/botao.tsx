import type { ButtonHTMLAttributes } from 'react'

export type TomBotao = 'primario' | 'secundario' | 'perigo' | 'texto'

const TOM: Record<TomBotao, string> = {
  primario: 'bg-escuro text-tinta-clara hover:bg-tinta',
  secundario: 'bg-superficie text-tinta border border-linha hover:bg-superficie-suave',
  perigo: 'bg-alerta text-white hover:brightness-95',
  texto: 'bg-transparent text-tinta-media underline hover:text-tinta',
}

/**
 * Alvo de toque de 44px por padrão.
 *
 * O protótipo desenha botões de 24px de altura na tela de Sessão, que é usada em
 * pé, numa sala, com a mão ocupada. Bonito na tela grande, impossível com o
 * polegar. `miudo` existe para ação secundária dentro de linha, nunca para
 * registro de presença.
 */
export function Botao({
  tom = 'primario',
  miudo = false,
  className = '',
  ...resto
}: {
  tom?: TomBotao
  miudo?: boolean
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const tamanho = miudo ? 'min-h-8 px-3 text-[12.5px]' : 'min-h-11 px-4 text-[13px]'
  return (
    <button
      {...resto}
      className={`inline-flex items-center justify-center gap-2 rounded-[--radius-padrao] font-medium transition-[background-color,color] duration-75 disabled:cursor-not-allowed disabled:opacity-50 ${TOM[tom]} ${tamanho} ${className}`}
    />
  )
}
