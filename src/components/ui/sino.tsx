'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { Icone } from './icones'
import { useFecharFora, usePosicionar } from './flutuante'
import type { Notificacao } from '@/server/notificacoes'

const TINTA_TIPO: Record<Notificacao['tipo'], string> = {
  cancelada: 'bg-alerta-fundo text-alerta',
  falta_avisada: 'bg-atencao-fundo text-atencao',
  encaixe: 'bg-positivo-fundo text-positivo',
  reposicao: 'bg-neutro-fundo text-tinta-media',
}

const GLIFO: Record<Notificacao['tipo'], string> = {
  cancelada: '⊘',
  falta_avisada: '!',
  encaixe: '+',
  reposicao: '↺',
}

/**
 * O sino, ao lado da busca.
 *
 * Aula cancelada e aluno que avisou que não vem são coisas que o dono descobre
 * tarde: hoje, pelo aluno na porta fechada ou pelo professor com uma pessoa a
 * mais na sala. O painel abre embaixo do ícone, com sete dias de novidade e o
 * link para a tela onde se resolve cada uma.
 *
 * A contagem some depois de aberta — na sessão, não no banco: marcar "lido"
 * por pessoa é outra tabela, e o valor aqui é ver o que mudou, não zerar
 * caixa.
 */
export function Sino({ itens }: { itens: Notificacao[] }) {
  const [aberto, setAberto] = useState(false)
  const [visto, setVisto] = useState(false)
  const botao = useRef<HTMLButtonElement>(null)
  const painel = usePosicionar(botao, aberto, 340)
  useFecharFora([botao, painel], aberto, () => setAberto(false))

  const novas = visto ? 0 : itens.length

  return (
    <>
      <button
        ref={botao}
        type="button"
        onClick={() => { setAberto((a) => !a); setVisto(true) }}
        aria-label={`Notificações${novas ? `, ${novas} novas` : ''}`}
        aria-expanded={aberto}
        className="relative flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-padrao border border-linha bg-superficie text-tinta-media transition-colors duration-150 hover:bg-superficie-mais-suave hover:text-tinta"
      >
        <Icone nome="sino" tamanho={19} />
        {novas > 0 ? (
          <span className="absolute top-1.5 right-1.5 flex min-w-4 items-center justify-center rounded-full bg-alerta px-1 font-mono text-[10px] leading-4 text-tinta-clara">
            {novas > 9 ? '9+' : novas}
          </span>
        ) : null}
      </button>

      {aberto ? (
        <div
          ref={painel}
          style={{ position: 'fixed', zIndex: 70 }}
          className="flex max-h-[420px] flex-col overflow-hidden rounded-grande border border-linha bg-superficie shadow-modal"
        >
          <div className="flex shrink-0 items-baseline justify-between gap-2 border-b border-linha-fina px-4 py-3">
            <span className="text-[13.5px] font-semibold">Notificações</span>
            <span className="text-[11.5px] text-tinta-fraca">últimos 7 dias</span>
          </div>

          {itens.length === 0 ? (
            <p className="px-4 py-6 text-center text-[12.5px] leading-relaxed text-tinta-media">
              Nada aconteceu na semana que precise da sua atenção.
              <br />
              Cancelamento e aviso de falta aparecem aqui.
            </p>
          ) : (
            <ul className="min-h-0 flex-1 overflow-y-auto p-1.5">
              {itens.map((n) => (
                <li key={n.id}>
                  <Link
                    href={n.href}
                    onClick={() => setAberto(false)}
                    className="flex items-start gap-2.5 rounded-padrao px-2.5 py-2.5 hover:bg-superficie-suave"
                  >
                    <span
                      aria-hidden
                      className={`flex size-7 shrink-0 items-center justify-center rounded-padrao font-mono text-[13px] ${TINTA_TIPO[n.tipo]}`}
                    >
                      {GLIFO[n.tipo]}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col leading-tight">
                      <span className="text-[13px] font-medium">{n.texto}</span>
                      {n.detalhe ? (
                        <span className="truncate text-[11.5px] text-tinta-fraca">
                          {n.detalhe}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-[11px] text-tinta-fraca">
                      {n.quando}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </>
  )
}
