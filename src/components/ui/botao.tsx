import type { ButtonHTMLAttributes } from 'react'
import { Icone, type NomeIcone } from './icones'

/**
 * Os tons de botão do design system.
 *
 * `claro` e `contorno-claro` existem para o painel escuro (acesso, hero, rail):
 * lá o primário não pode ser `#12211C`, que some no fundo.
 */
export type TomBotao =
  | 'primario'
  | 'secundario'
  | 'fantasma'
  | 'perigo'
  | 'perigo-leve'
  | 'tracejado'
  | 'claro'
  | 'contorno-claro'

const TOM: Record<TomBotao, string> = {
  primario: 'bg-escuro text-tinta-clara font-semibold hover:bg-escuro-hover active:translate-y-px',
  secundario: 'bg-superficie text-tinta border border-linha hover:bg-superficie-mais-suave',
  fantasma: 'bg-transparent text-tinta-media hover:text-tinta',
  perigo: 'bg-alerta text-white font-semibold hover:bg-alerta-forte active:translate-y-px',
  'perigo-leve': 'bg-transparent text-alerta hover:text-alerta-mais-forte',
  tracejado: 'border border-dashed border-linha-tracejada text-marca hover:bg-superficie-suave',
  claro: 'bg-menta text-sobre-menta font-semibold hover:bg-menta-hover active:translate-y-px',
  'contorno-claro':
    'bg-transparent border border-tinta-clara/20 text-tinta-clara hover:bg-tinta-clara/10',
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
  const tamanho = miudo ? 'min-h-8 px-3 text-[12.5px]' : 'min-h-11 px-4 text-[13.5px]'
  return (
    <button
      {...resto}
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-media font-medium whitespace-nowrap transition-[background-color,color,transform] duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${TOM[tom]} ${tamanho} ${className}`}
    />
  )
}

/**
 * Botão de ícone: quadrado, sem rótulo visível.
 *
 * `titulo` é obrigatório — ícone sozinho sem nome é um botão que só quem
 * desenhou sabe para que serve, e é invisível para leitor de tela.
 *
 * 34px no desktop, como o design system pede, e 44px no celular, onde o alvo é
 * o polegar e não o cursor.
 */
export function BotaoIcone({
  icone,
  titulo,
  perigo = false,
  className = '',
  ...resto
}: {
  icone: NomeIcone
  titulo: string
  perigo?: boolean
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      {...resto}
      className={`inline-flex size-11 cursor-pointer items-center justify-center rounded-peca border border-linha-suave bg-superficie text-tinta-media transition-colors duration-150 md:size-[34px] ${
        perigo
          ? 'hover:border-alerta-linha-forte hover:bg-alerta-superficie hover:text-alerta'
          : 'hover:bg-superficie-mais-suave hover:text-tinta'
      } ${className}`}
    >
      <Icone nome={icone} />
    </button>
  )
}
