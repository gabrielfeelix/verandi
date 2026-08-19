'use client'

import { useState, type ReactNode } from 'react'
import { cartao } from '@/components/ui/pecas'

/**
 * A casca das seções de configuração, com as medidas do protótipo.
 *
 * O padrão é sempre o mesmo: um cartão branco de 20px de raio, cabeçalho com
 * título, subtítulo e a ação primária à direita, e **linhas separadas por
 * divisória** — não cartões soltos dentro do cartão. Lista com moldura em cada
 * item vira ruído quando são quarenta pessoas.
 */
export function PainelConfig({
  titulo, sub, acao, children,
}: {
  titulo: string
  sub?: string
  acao?: ReactNode
  children: ReactNode
}) {
  return (
    <section className={`overflow-hidden ${cartao}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-linha-fina px-5 py-4">
        <div>
          <h2 className="font-titulo text-[19px] font-semibold">{titulo}</h2>
          {sub ? (
            <p className="pt-[3px] text-[13.5px] text-tinta-media">{sub}</p>
          ) : null}
        </div>
        {acao}
      </div>
      {children}
    </section>
  )
}

/**
 * Uma linha da lista: nome em cima, o detalhe embaixo, etiquetas e a ação à
 * direita.
 *
 * `apagado` é o item desativado — continua legível, mas para de disputar
 * atenção com o que está no ar.
 */
export function LinhaConfig({
  nome, detalhe, antes, apagado = false, children,
}: {
  nome: ReactNode
  detalhe?: ReactNode
  /** o que vem antes do texto e não rola com ele: avatar, glifo, cor */
  antes?: ReactNode
  apagado?: boolean
  children?: ReactNode
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-3.5 gap-y-2.5 border-b border-linha-fina px-5 py-3.5 last:border-b-0 hover:bg-superficie-tenue ${
        apagado ? 'bg-[#FDFDFC]' : ''
      }`}
    >
      {antes}
      <div className="flex min-w-0 flex-[1_1_180px] flex-col leading-[1.35]">
        <span
          className={`text-[15px] font-medium ${apagado ? 'text-tinta-media' : ''}`}
        >
          {nome}
        </span>
        {detalhe ? (
          <span className="text-[13px] text-tinta-media">{detalhe}</span>
        ) : null}
      </div>
      {children}
    </div>
  )
}

/** O número entre parênteses da linha — capacidade, duração, contagem. */
export function Dado({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-peca bg-superficie-mais-suave px-2.5 py-1 font-mono text-[13px] text-tinta-media">
      {children}
    </span>
  )
}

/** O estado do item: ativo em verde, desativado em neutro. */
export function Estado({ ativo }: { ativo: boolean }) {
  return (
    <span
      className={`rounded-peca px-2.5 py-[5px] text-[12.5px] font-medium ${
        ativo ? 'bg-positivo-fundo text-positivo' : 'bg-alerta-fundo text-alerta'
      }`}
    >
      {ativo ? 'Ativo' : 'Desativado'}
    </span>
  )
}

/** "Editar" é botão contornado, não link sublinhado — é ação, não navegação. */
export function BotaoLinha({
  children, tom = 'neutro', className = '', ...resto
}: {
  children: ReactNode
  /* `perigo` é vermelho, e vermelho aqui é só o que tira algo do ar:
     desativar, excluir. Fechar e cancelar não são perigo — são desistir. */
  tom?: 'neutro' | 'marca' | 'perigo'
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...resto}
      className={`min-h-9 rounded-peca border px-3 text-[13.5px] whitespace-nowrap disabled:opacity-50 ${
        tom === 'marca'
          ? 'border-linha-suave bg-superficie text-marca hover:bg-positivo-superficie'
          : tom === 'perigo'
            ? 'border-alerta-linha-forte bg-alerta-superficie text-alerta hover:bg-alerta-fundo'
            : 'border-linha-suave bg-superficie text-tinta-media hover:bg-superficie-suave hover:text-tinta'
      } ${className}`}
    >
      {children}
    </button>
  )
}

/**
 * A gaveta dos desativados, no pé da lista.
 *
 * Eles não somem — o histórico depende deles — mas também não ficam misturados
 * com o que está no ar, porque a pergunta do dia é "o que existe hoje".
 */
export function Recolhivel({
  rotulo, children,
}: {
  rotulo: string
  children: ReactNode
}) {
  const [aberto, setAberto] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        className="flex w-full items-center justify-between gap-3 border-t border-linha-fina bg-superficie-tenue px-5 py-3.5 text-left hover:bg-superficie-mais-suave"
      >
        <span className="text-[13.5px] text-tinta-media">{rotulo}</span>
        <span aria-hidden className="font-mono text-[14px] text-tinta-inativa">
          {aberto ? '▴' : '▾'}
        </span>
      </button>
      {aberto ? children : null}
    </>
  )
}

/** A faixa de formulário dentro do painel, com o fundo suave do protótipo. */
export function FaixaFormulario({ children }: { children: ReactNode }) {
  return (
    <div className="border-b border-linha-fina bg-superficie-suave px-5 py-4">
      {children}
    </div>
  )
}
