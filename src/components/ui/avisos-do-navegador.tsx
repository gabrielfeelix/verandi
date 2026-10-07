'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { notificacoesRecentes } from '@/server/notificacoes-acoes'
import { publicarNotificacoes } from './notificacoes'

const AVISADAS = 'verandi:notificacoes-avisadas'
const INTERVALO = 45_000

/**
 * Busca as notificações a cada 45 segundos, em qualquer tela, e avisa no
 * navegador o que chegou de novo: "Maria Betania confirmou presença pelo
 * WhatsApp" aparece mesmo com a Verandi numa aba de fundo.
 *
 * A primeira busca só anota o que já existe: abrir o sistema não pode
 * disparar trinta avisos da semana. A permissão do navegador é pedida no
 * sino, num clique, porque pedir sozinho ao abrir a página é o que faz a
 * pessoa clicar em "Bloquear".
 */
export function AvisosDoNavegador() {
  const router = useRouter()

  useEffect(() => {
    let parado = false
    let primeira = true

    async function buscar() {
      if (parado) return
      let lista
      try { lista = await notificacoesRecentes() } catch { return }
      if (parado) return
      publicarNotificacoes(lista)

      let avisadas: string[] = []
      try { avisadas = JSON.parse(localStorage.getItem(AVISADAS) ?? '[]') as string[] } catch { avisadas = [] }
      const conhecidas = new Set(avisadas)
      const novas = lista.filter((n) => !conhecidas.has(n.id))
      try {
        localStorage.setItem(AVISADAS, JSON.stringify([...avisadas, ...novas.map((n) => n.id)].slice(-300)))
      } catch { /* sem espaço */ }

      const semHistorico = avisadas.length === 0
      if ((primeira && semHistorico) || !novas.length) { primeira = false; return }
      primeira = false
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return

      // mais de três de uma vez viram um aviso só, para não empilhar a tela
      const mostrar = novas.length > 3
        ? [{ ...novas[0], quem: '', texto: `${novas.length} novidades na agenda`, detalhe: 'Abra o sino para ver', href: '/hoje' }]
        : novas
      for (const n of mostrar) {
        const aviso = new Notification(
          n.quem ? `${n.quem} ${n.texto}` : n.texto,
          {
            body: [n.peloBot ? 'Pelo WhatsApp' : '', n.detalhe].filter(Boolean).join(' · '),
            tag: n.id,
            icon: '/favicon.ico',
          },
        )
        aviso.onclick = () => { window.focus(); router.push(n.href); aviso.close() }
      }
    }

    buscar()
    const relogio = window.setInterval(buscar, INTERVALO)
    const aoVoltar = () => { if (document.visibilityState === 'visible') buscar() }
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      parado = true
      window.clearInterval(relogio)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [router])

  return null
}
