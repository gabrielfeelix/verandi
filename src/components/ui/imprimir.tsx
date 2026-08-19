'use client'

/**
 * A grade em papel.
 *
 * Parece supérfluo num produto de tela e não é: a grade da semana pregada na
 * parede da recepção é como a operação real funciona hoje, com a planilha
 * impressa. Tirar o papel de uma vez é o jeito mais rápido de o produto ser
 * abandonado na segunda semana.
 *
 * O que sai da folha está em `@media print`, no `globals.css` — aqui é só o
 * botão, porque `window.print()` precisa de um clique de verdade.
 */
export function BotaoImprimir({ rotulo = 'Imprimir' }: { rotulo?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-11 cursor-pointer items-center rounded-padrao border border-linha bg-superficie px-3.5 text-[14px] font-medium transition-colors duration-150 hover:bg-superficie-mais-suave"
    >
      {rotulo}
    </button>
  )
}
