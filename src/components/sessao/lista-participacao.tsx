'use client'

import { useOptimistic, useState, useTransition } from 'react'
import type { ParticipacaoDetalhe } from '@/server/agenda/consultas'
import type { StatusParticipacao } from '@/core/agenda/ocupacao'
import { marcarTodosPresentes, mudarStatus, removerParticipacao } from '@/server/agenda/acoes'

const STATUS: Array<{ valor: StatusParticipacao; curto: string; titulo: string }> = [
  { valor: 'presente',      curto: 'Veio',   titulo: 'Presente' },
  { valor: 'falta',         curto: 'Faltou', titulo: 'Faltou sem avisar' },
  { valor: 'falta_avisada', curto: 'Avisou', titulo: 'Avisou que não vem — libera a vaga' },
  { valor: 'licenca',       curto: 'Licença', titulo: 'Afastado, mantém o horário' },
]

const ORIGEM: Record<string, string> = {
  recorrente: 'Fixo',
  avulso: 'Avulso',
  reposicao: 'Reposição',
  encaixe: 'Encaixe',
  reserva: 'Reserva',
}

type Props = {
  participacoes: ParticipacaoDetalhe[]
  sessaoId: string
  podeRegistrar: boolean
  rotuloPessoas: string
}

export function ListaParticipacao({
  participacoes, sessaoId, podeRegistrar, rotuloPessoas,
}: Props) {
  const [pendente, iniciar] = useTransition()
  const [desfazer, setDesfazer] = useState<
    { id: string; anterior: StatusParticipacao; nome: string } | null
  >(null)

  // escrita otimista: a tela é usada em sala, com sinal ruim. O registro
  // aparece aplicado na hora e sincroniza depois.
  const [lista, aplicar] = useOptimistic(
    participacoes,
    (atual, mudanca: { id: string; status: StatusParticipacao } | { todos: true }) =>
      'todos' in mudanca
        ? atual.map((p) =>
            p.status === 'esperada' || p.status === 'confirmada'
              ? { ...p, status: 'presente' as StatusParticipacao }
              : p)
        : atual.map((p) => (p.id === mudanca.id ? { ...p, status: mudanca.status } : p)),
  )

  const pendentes = lista.filter(
    (p) => p.status === 'esperada' || p.status === 'confirmada',
  ).length

  function registrar(p: ParticipacaoDetalhe, status: StatusParticipacao) {
    setDesfazer({ id: p.id, anterior: p.status, nome: p.nome })
    iniciar(async () => {
      aplicar({ id: p.id, status })
      await mudarStatus(p.id, status)
    })
  }

  if (lista.length === 0) {
    return <p className="opacity-70">Ninguém marcado neste horário ainda.</p>
  }

  return (
    <div className="flex flex-col gap-3">
      {podeRegistrar && pendentes > 0 ? (
        <button
          type="button"
          disabled={pendente}
          onClick={() => iniciar(async () => {
            aplicar({ todos: true })
            await marcarTodosPresentes(sessaoId)
          })}
          className="rounded border px-4 py-3 font-medium"
        >
          Todos vieram ({pendentes})
        </button>
      ) : null}

      {desfazer ? (
        <p role="status" className="text-sm">
          {desfazer.nome} atualizado.{' '}
          <button
            type="button"
            className="underline"
            onClick={() => {
              const d = desfazer
              setDesfazer(null)
              iniciar(async () => {
                aplicar({ id: d.id, status: d.anterior })
                await mudarStatus(d.id, d.anterior)
              })
            }}
          >
            Desfazer
          </button>
        </p>
      ) : null}

      <ul className="flex flex-col gap-2" aria-label={rotuloPessoas}>
        {lista.map((p) => (
          <li key={p.id} className="rounded border p-3">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-medium">{p.nome}</span>

              {/* origem distinguível de relance: quem tem lugar fixo e quem
                  entrou de encaixe são situações diferentes para quem dá a aula */}
              <span
                className="rounded border px-1.5 text-xs"
                data-origem={p.origem}
              >
                {ORIGEM[p.origem] ?? p.origem}
              </span>

              {p.tags.map((t) => (
                <span key={t} className="rounded border px-1.5 text-xs">{t}</span>
              ))}

              {p.telefone === null ? (
                <span className="text-xs opacity-60" title="Sem telefone cadastrado">
                  sem telefone
                </span>
              ) : null}

              {p.reposicaoDeId ? (
                <span className="text-xs opacity-60">repõe uma falta</span>
              ) : null}
            </div>

            {p.observacao ? (
              <p className="mt-1 text-sm opacity-70">{p.observacao}</p>
            ) : null}

            {podeRegistrar ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {STATUS.map((s) => (
                  <button
                    key={s.valor}
                    type="button"
                    title={s.titulo}
                    disabled={pendente}
                    aria-pressed={p.status === s.valor}
                    onClick={() => registrar(p, s.valor)}
                    className="rounded border px-2 py-1 text-sm aria-pressed:font-bold"
                  >
                    {s.curto}
                  </button>
                ))}

                <button
                  type="button"
                  className="ml-auto text-sm underline opacity-70"
                  onClick={() => {
                    if (confirm(`Tirar ${p.nome} deste horário?`)) {
                      iniciar(() => removerParticipacao(p.id))
                    }
                  }}
                >
                  Tirar
                </button>
              </div>
            ) : (
              <p className="mt-1 text-sm opacity-70">{p.status}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
