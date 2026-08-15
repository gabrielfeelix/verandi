import Link from 'next/link'
import { LINKS_LEGAIS } from '@/core/legal'

/**
 * O rodapé com os documentos, discreto e em toda tela.
 *
 * Ele existe porque documento que ninguém acha é documento que não existe: a
 * política de privacidade pode estar impecável e continuar sem servir para nada
 * se o único caminho até ela for perguntar para a 4YU.
 *
 * Discreto de propósito. Isto é tela de trabalho, e ninguém abre a Verandi para
 * ler contrato; o link precisa estar sempre disponível e nunca disputar atenção
 * com a chamada do dia.
 */
export function RodapeLegal({ className = '' }: { className?: string }) {
  return (
    <footer className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-tinta-fraca ${className}`}>
      <span>Verandi, um produto 4YU</span>
      {LINKS_LEGAIS.map((l) => (
        <Link key={l.href} href={l.href} className="hover:text-tinta-media hover:underline">
          {l.rotulo}
        </Link>
      ))}
    </footer>
  )
}
