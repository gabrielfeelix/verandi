import type { CSSProperties, ReactNode } from 'react'

/**
 * A tabela da casa: Cobranças, Alunos, Recibos.
 *
 * Nasceu na Cobranças (`financeiro/lista.tsx`) e subiu para cá quando Alunos e
 * Recibos deixaram de ser pilha de cartões, no mesmo desenho da tabela do
 * AutoFluxos (`autofluxos/src/components/design/tabela.tsx`): cartão que rola
 * de lado por dentro, cabeçalho numa faixa tênue, primeira coluna presa ao
 * rolar, o mesmo fundo de linha no hover.
 *
 * Linha: `<tr className={LINHA}>`; primeira célula: `<td className={CELULA_FIXA}>`;
 * demais: `<td className={CELULA}>`.
 */
export const LINHA = 'group border-b border-linha-suave last:border-b-0 hover:bg-superficie-tenue'
export const CELULA = 'px-4 py-3'
export const CELULA_FIXA = 'sticky left-0 z-[1] bg-superficie px-4 py-3 group-hover:bg-superficie-tenue'

export function Tabela({
  largura = 760, soNoDesktop = false, rotulo, children,
}: {
  /** abaixo disto a tabela rola de lado em vez de espremer as colunas */
  largura?: number
  /**
   * no celular a tabela cabe na tela e esconde as colunas secundárias
   * (`max-md:hidden` no `Th` e no `td`), em vez de rolar de lado e deixar a última
   * coluna fora da vista
   */
  soNoDesktop?: boolean
  rotulo?: string
  children: ReactNode
}) {
  return (
    <div className="overflow-x-auto rounded-grande border border-linha bg-superficie">
      <table
        aria-label={rotulo}
        className={`w-full border-collapse text-left ${
          soNoDesktop ? 'md:min-w-(--largura)' : 'min-w-(--largura)'
        }`}
        style={{ '--largura': `${largura}px` } as CSSProperties}
      >
        {children}
      </table>
    </div>
  )
}

/** A faixa do cabeçalho: um `<tr>` só, já com o fundo. */
export function Cabecalho({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-linha bg-superficie-tenue">{children}</tr>
    </thead>
  )
}

export function Th({ children, className = '', fixa = false }: {
  children?: ReactNode; className?: string; fixa?: boolean
}) {
  return (
    <th
      scope="col"
      className={`px-4 py-3 text-[12px] font-semibold whitespace-nowrap text-tinta-fraca ${
        fixa ? 'sticky left-0 z-[2] bg-superficie-tenue' : ''
      } ${className}`}
    >
      {children}
    </th>
  )
}
