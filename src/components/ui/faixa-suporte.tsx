'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { sairDoSuporte } from '@/server/suporte/acoes'

/**
 * A faixa que não some.
 *
 * Enquanto alguém da 4YU está dentro da conta de um cliente, isso fica visível
 * em toda tela e em todo tamanho. Ver dado de cliente sem que ninguém saiba é o
 * tipo de acesso que precisa ser constrangedor de propósito.
 */
export function FaixaSuporte({ conta }: { conta: string }) {
  const [pendente, iniciar] = useTransition()
  const router = useRouter()

  return (
    <div
      role="status"
      // âmbar, como no protótipo: é aviso permanente, não erro. Vermelho aqui
      // gritaria a mesma coisa em toda tela até perder o efeito.
      className="flex flex-wrap items-center justify-between gap-3 bg-atencao px-4 py-2 text-[#FFF8E8]"
    >
      <span className="text-[12.5px] font-medium">
        Você está dentro de {conta} como suporte da 4YU. Tudo que fizer fica
        registrado com o seu nome.
      </span>
      <button
        type="button"
        disabled={pendente}
        onClick={() => iniciar(async () => {
          await sairDoSuporte()
          router.push('/contas-4yu')
        })}
        className="min-h-9 rounded-peca bg-white/15 px-3 text-[12.5px] font-medium"
      >
        Sair do suporte
      </button>
    </div>
  )
}
