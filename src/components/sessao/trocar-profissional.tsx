'use client'

import { useState, useTransition } from 'react'
import { trocarProfissionalDaSessao } from '@/server/agenda/acoes'
import { useAviso } from '@/components/ui/desfazer'
import { AvatarProf } from '@/components/hoje/pecas'

/**
 * Trocar quem atende **só nesta sessão** — cobrir uma quarta não é mudar a
 * grade.
 *
 * A frase inteira é o link de propósito: "trocar" sozinho não diz que o alcance
 * é de um dia só, e essa é justamente a confusão mais provável do sistema.
 */
export function TrocarProfissional({
  sessaoId, atual, equipe, rotulo, rotuloSessao,
}: {
  sessaoId: string
  atual: string | null
  equipe: Array<{ id: string; nome: string; cor: string | null }>
  rotulo: string
  rotuloSessao: string
}) {
  const [aberto, setAberto] = useState(false)
  const [pendente, iniciar] = useTransition()
  const avisar = useAviso()

  function trocar(id: string | null, nome: string) {
    setAberto(false)
    iniciar(async () => {
      await trocarProfissionalDaSessao(sessaoId, id)
      avisar({ texto: `${nome} atende ${rotuloSessao.toLowerCase()} deste horário` })
    })
  }

  return (
    <span className="relative">
      <button
        type="button"
        disabled={pendente}
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        className="font-medium text-marca hover:text-marca-forte"
      >
        trocar {rotulo.toLowerCase()} só neste horário
      </button>

      {aberto ? (
        <span className="absolute top-7 left-0 z-30 flex w-64 flex-col gap-0.5 rounded-grande border border-linha-suave bg-superficie p-1.5 shadow-elevado">
          {equipe.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={pendente}
              onClick={() => trocar(p.id, p.nome)}
              className={`flex items-center gap-2.5 rounded-peca px-2.5 py-2 text-left text-[14px] hover:bg-superficie-suave ${
                p.id === atual ? 'bg-positivo-superficie font-medium' : ''
              }`}
            >
              <AvatarProf nome={p.nome} cor={p.cor} tamanho={26} />
              {p.nome}
            </button>
          ))}

          {atual ? (
            <button
              type="button"
              disabled={pendente}
              onClick={() => trocar(null, `Ninguém`)}
              className="rounded-peca px-2.5 py-2 text-left text-[14px] text-tinta-media hover:bg-superficie-suave"
            >
              Deixar sem {rotulo.toLowerCase()}
            </button>
          ) : null}

          <span className="px-2.5 py-2 text-[12.5px] leading-relaxed text-tinta-media">
            Vale só para este dia. A grade continua com quem estava.
          </span>
        </span>
      ) : null}
    </span>
  )
}
