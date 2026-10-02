'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAviso } from './desfazer'

/**
 * Por que a pessoa caiu em Hoje.
 *
 * Quem abre uma tela que o papel não alcança volta para cá com
 * `?restrita=<tela>`. Voltar calado parecia defeito: a recepção que abria a
 * Configuração por um link guardado achava que o sistema tinha caído. O
 * parâmetro sai da URL para que recarregar não repita o aviso.
 */
export function AvisoDeAcesso({ tela }: { tela: string }) {
  const avisar = useAviso()
  const router = useRouter()
  const caminho = usePathname()
  const feito = useRef(false)
  useEffect(() => {
    if (feito.current) return
    feito.current = true
    avisar({ texto: `A tela ${tela} não está liberada para o seu acesso.` })
    router.replace(caminho, { scroll: false })
  }, [avisar, router, caminho, tela])
  return null
}
