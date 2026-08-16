'use client'

import { useRouter } from 'next/navigation'
import { Icone } from './icones'

/**
 * Voltar para a tela anterior — a de verdade, não a que a trilha supõe.
 *
 * A trilha só sabe levar para a lista de cadastros. Quem chegou na ficha
 * pela agenda, pela busca do Hoje ou por Pendências queria desfazer o passo que
 * deu, e acabava caindo numa terceira tela. Isto é o `history.back()` do
 * navegador, com alvo de toque e nome — no celular não existe o botão do
 * navegador na mão de quem está usando o sistema em pé, dentro da sala.
 */
export function Voltar({ rotulo = 'Voltar' }: { rotulo?: string }) {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="flex min-h-9 cursor-pointer items-center gap-1 rounded-peca pr-2 pl-1 text-[12.5px] font-medium text-tinta-media transition-colors duration-150 hover:bg-superficie-mais-suave hover:text-tinta"
    >
      <Icone nome="antes" tamanho={15} />
      {rotulo}
    </button>
  )
}
