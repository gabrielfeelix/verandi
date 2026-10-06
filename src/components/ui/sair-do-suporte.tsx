'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { sairDoSuporte } from '@/server/suporte/acoes'

/**
 * O "Sair" de quem está como suporte dentro da conta de um cliente.
 *
 * Ocupa o lugar do "Sair" comum, no pé do rail e na folha do celular, em vez de
 * uma faixa no topo de toda tela. Quem é suporte já se vê no papel ("Suporte
 * 4YU") logo ao lado, e o acesso continua registrado com o nome da pessoa: a
 * faixa só repetia isso e roubava altura de toda tela.
 *
 * Sair daqui encerra o acesso e volta à administração, não desloga: quem está
 * atendendo um cliente quase sempre vai abrir o próximo.
 */
export function SairDoSuporte({ claro = false }: { claro?: boolean }) {
  const [pendente, iniciar] = useTransition()
  const router = useRouter()

  return (
    <button
      type="button"
      aria-label="Sair do suporte"
      title="Sair do suporte e voltar à administração"
      disabled={pendente}
      onClick={() => iniciar(async () => {
        await sairDoSuporte()
        router.push('/admin/empresas')
      })}
      className={claro
        ? 'flex min-h-11 shrink-0 items-center gap-2 rounded-padrao border border-linha px-3.5 text-[14.5px] text-tinta-media'
        : 'min-h-9 shrink-0 rounded-peca px-2 text-[13.5px] text-tinta-escura-fraca underline hover:text-tinta-clara'}
    >
      {pendente ? 'Saindo…' : 'Sair'}
    </button>
  )
}
