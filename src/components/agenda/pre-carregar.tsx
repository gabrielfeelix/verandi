'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

/**
 * Deixa as semanas em volta prontas antes do clique.
 *
 * Trocar de semana refazia tudo no servidor: conta, gerar as aulas da semana,
 * buscar as aulas com quem está em cada uma. Só a vizinha vinha pré-carregada,
 * e quem clicava duas vezes seguidas esperava de novo (Gabriel, 13/10/2026:
 * "muito demorado, sério").
 *
 * `router.prefetch` guarda a página inteira no cache do navegador por cinco
 * minutos (`staleTimes.static`), e é dele que a seta lê. A lista vem na ordem
 * de quem tem mais chance de ser aberta: a próxima, a anterior, e assim por
 * diante. Um pedido por vez, depois que a tela atual terminou: pré-carregar
 * não pode atrasar o que já se está vendo. Ao andar, a tela nova manda a lista
 * dela, e a janela anda junto.
 */
export function PreCarregar({ hrefs }: { hrefs: string[] }) {
  const router = useRouter()
  const chave = hrefs.join('\n')

  useEffect(() => {
    const fila = chave ? chave.split('\n') : []
    let cancelado = false
    let i = 0
    let espera: ReturnType<typeof setTimeout> | undefined

    const proximo = () => {
      if (cancelado || i >= fila.length) return
      router.prefetch(fila[i++])
      espera = setTimeout(proximo, 250)
    }
    espera = setTimeout(proximo, 400)

    return () => {
      cancelado = true
      clearTimeout(espera)
    }
  }, [chave, router])

  return null
}
