'use client'

import {
  createContext, useContext, useOptimistic, useState, useTransition,
  type ReactNode,
} from 'react'
import type { ParticipacaoDetalhe } from '@/server/agenda/consultas'
import type { StatusParticipacao } from '@/core/agenda/ocupacao'
import { marcarTodosPresentes, mudarStatus } from '@/server/agenda/acoes'
import { useAviso } from '@/components/ui/desfazer'
import { cartao } from '@/components/ui/pecas'
import { Icone } from '@/components/ui/icones'

/**
 * O estado vivo da chamada, num lugar só.
 *
 * A tela mostra o mesmo número em quatro cantos — a etiqueta do cabeçalho, a
 * nota embaixo do título, o "Resumo da chamada" e a barra que fica colada no
 * rodapé. Se cada um deles lesse do servidor, marcar uma presença atualizaria um
 * e deixaria os outros três mentindo até o próximo carregamento.
 *
 * O registro é **otimista** porque esta tela é usada em pé, numa sala, com sinal
 * ruim: a marca aparece no toque e sincroniza depois.
 */
type Chamada = {
  lista: ParticipacaoDetalhe[]
  /** quantos ainda não têm nada registrado */
  pendentes: number
  /** quantos já foram decididos */
  registrados: number
  total: number
  podeRegistrar: boolean
  ocupado: boolean
  registrar: (p: ParticipacaoDetalhe, status: StatusParticipacao) => void
  marcarTodos: () => void
  agir: (fn: () => Promise<void>, texto: string) => void
  /** o modal de encaixe é aberto de três lugares; o estado dele mora aqui */
  encaixeAberto: boolean
  abrirEncaixe: () => void
  fecharEncaixe: () => void
  cancelarAberto: boolean
  abrirCancelar: () => void
  fecharCancelar: () => void
}

const Contexto = createContext<Chamada | null>(null)

export function useChamada(): Chamada {
  const c = useContext(Contexto)
  if (!c) throw new Error('useChamada fora do ProvedorChamada')
  return c
}

const ABERTOS: ReadonlySet<StatusParticipacao> = new Set(['esperada', 'confirmada'])

export function ProvedorChamada({
  participacoes, sessaoId, podeRegistrar, children,
}: {
  participacoes: ParticipacaoDetalhe[]
  sessaoId: string
  podeRegistrar: boolean
  children: ReactNode
}) {
  const [pendente, iniciar] = useTransition()
  const avisar = useAviso()
  const [encaixeAberto, setEncaixe] = useState(false)
  const [cancelarAberto, setCancelar] = useState(false)

  const [lista, aplicar] = useOptimistic(
    participacoes,
    (atual, mudanca: { id: string; status: StatusParticipacao } | { todos: true }) =>
      'todos' in mudanca
        ? atual.map((p) =>
            ABERTOS.has(p.status) ? { ...p, status: 'presente' as StatusParticipacao } : p)
        : atual.map((p) => (p.id === mudanca.id ? { ...p, status: mudanca.status } : p)),
  )

  const pendentes = lista.filter((p) => ABERTOS.has(p.status)).length

  const valor: Chamada = {
    lista,
    pendentes,
    registrados: lista.length - pendentes,
    total: lista.length,
    podeRegistrar,
    ocupado: pendente,
    registrar: (p, status) => iniciar(async () => {
      aplicar({ id: p.id, status })
      await mudarStatus(p.id, status)
      // desfazer, não confirmar: o registro acontece e volta atrás num toque
      avisar({
        texto: `${p.nome} atualizado.`,
        desfazer: () => iniciar(async () => {
          aplicar({ id: p.id, status: p.status })
          await mudarStatus(p.id, p.status)
        }),
      })
    }),
    marcarTodos: () => iniciar(async () => {
      aplicar({ todos: true })
      const { marcadas } = await marcarTodosPresentes(sessaoId)
      avisar({ texto: `${marcadas} marcada(s) como presente` })
    }),
    agir: (fn, texto) => iniciar(async () => {
      await fn()
      avisar({ texto })
    }),
    encaixeAberto,
    abrirEncaixe: () => setEncaixe(true),
    fecharEncaixe: () => setEncaixe(false),
    cancelarAberto,
    abrirCancelar: () => setCancelar(true),
    fecharCancelar: () => setCancelar(false),
  }

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

/** O rótulo do estado, derivado da lista viva — nunca de coluna no banco. */
function estadoDe(registrados: number, total: number) {
  if (total === 0) return { rotulo: 'Sem ninguém', cor: 'bg-neutro-fundo text-tinta-media' }
  if (registrados === total) {
    return { rotulo: 'Chamada feita', cor: 'bg-positivo-fundo text-positivo' }
  }
  if (registrados > 0) {
    return { rotulo: 'Chamada em andamento', cor: 'bg-atencao-fundo text-atencao' }
  }
  return { rotulo: 'Chamada pendente', cor: 'bg-alerta-fundo text-alerta' }
}

export function EtiquetaEstado({ cancelada = false }: { cancelada?: boolean }) {
  const { registrados, total } = useChamada()
  const e = cancelada
    ? { rotulo: 'Cancelada', cor: 'bg-neutro-fundo text-tinta-media' }
    : estadoDe(registrados, total)
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-peca px-2.5 py-[5px] text-[11.5px] font-medium ${e.cor}`}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {e.rotulo}
    </span>
  )
}

/**
 * A terceira linha do cabeçalho: o que já foi registrado, e quanto falta começar.
 *
 * "Nenhum registro ainda" é diferente de "0 presentes": o primeiro diz que
 * ninguém abriu a chamada, o segundo diria que a turma inteira faltou.
 */
export function NotaDeRegistro({ comecaEm }: { comecaEm: string | null }) {
  const { registrados, total } = useChamada()
  const texto = registrados === 0
    ? ['Nenhum registro ainda', comecaEm].filter(Boolean).join(' · ')
    : `${registrados} de ${total} registrados`
  return <p className="text-[12px] text-tinta-media">{texto}</p>
}

export function BotaoMarcarTodos({ miudo = false }: { miudo?: boolean }) {
  const { podeRegistrar, pendentes, ocupado, marcarTodos } = useChamada()
  if (!podeRegistrar || pendentes === 0) return null
  return (
    <button
      type="button"
      disabled={ocupado}
      onClick={marcarTodos}
      className={`cursor-pointer rounded-media bg-escuro font-semibold whitespace-nowrap text-tinta-clara transition-colors duration-150 hover:bg-escuro-hover active:translate-y-px disabled:opacity-50 ${
        miudo ? 'min-h-11 px-[18px] text-[13.5px]' : 'min-h-12 px-4 text-[14px]'
      }`}
    >
      Marcar todos presentes
    </button>
  )
}

export function BotaoEncaixar({
  rotulo, className = '',
}: {
  rotulo: string
  className?: string
}) {
  const { podeRegistrar, abrirEncaixe } = useChamada()
  if (!podeRegistrar) return null
  return (
    <button
      type="button"
      onClick={abrirEncaixe}
      className={`min-h-11 cursor-pointer rounded-media border border-linha bg-superficie-suave px-3 text-[13px] whitespace-nowrap transition-colors duration-150 hover:bg-superficie-mais-suave ${className}`}
    >
      {rotulo}
    </button>
  )
}

/**
 * Cancelar a turma inteira: só o glifo, com nome acessível.
 *
 * Fica ao lado de "encaixar" e não dentro de um menu porque é a segunda coisa
 * mais feita nesta tela quando o dia dá errado — professora doente, sala
 * interditada. Escondê-la num menu faria ligar para a recepção.
 */
export function BotaoCancelarTurma({ rotulo }: { rotulo: string }) {
  const { podeRegistrar, abrirCancelar } = useChamada()
  if (!podeRegistrar) return null
  return (
    <button
      type="button"
      title={rotulo}
      aria-label={rotulo}
      onClick={abrirCancelar}
      className="flex min-h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-media border border-alerta-linha bg-alerta-superficie text-alerta transition-colors duration-150 hover:bg-alerta-fundo"
    >
      <Icone nome="proibido" tamanho={18} />
    </button>
  )
}

export function ResumoChamada() {
  const { lista, registrados, total } = useChamada()
  const conta = (s: StatusParticipacao) => lista.filter((p) => p.status === s).length

  return (
    <section className={`${cartao} p-4`}>
      <h2 className="font-titulo text-[17px] font-semibold">Resumo da chamada</h2>
      <p className="pt-1 pb-3.5 text-[12px] text-tinta-media">
        {registrados} de {total} registrados
      </p>
      <ul className="flex flex-col gap-2.5">
        {([
          ['Presente', conta('presente'), 'bg-positivo'],
          ['Falta', conta('falta'), 'bg-alerta'],
          ['Falta avisada', conta('falta_avisada'), 'bg-atencao'],
          ['Licença', conta('licenca'), 'bg-licenca'],
        ] as const).map(([rotulo, n, cor]) => (
          <li key={rotulo} className="flex items-center gap-2.5">
            <span aria-hidden className={`size-2 rounded-full ${cor}`} />
            <span className="flex-1 text-[13px]">{rotulo}</span>
            <span className="font-mono text-[13px] text-tinta-media">{n}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * A barra que não sai da tela.
 *
 * Numa turma longa, rolar até o fim para saber se a chamada está feita é o tipo
 * de atrito que faz voltar para a planilha.
 */
export function BarraChamada({ cancelada }: { cancelada: boolean }) {
  const { registrados, total, podeRegistrar } = useChamada()
  return (
    <div className="sticky bottom-3.5 z-20 flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 rounded-grande border border-linha bg-superficie px-4 py-3 shadow-[0_16px_34px_-22px_rgba(20,26,24,.5)]">
      <div className="flex min-w-0 items-center gap-3">
        <EtiquetaEstado cancelada={cancelada} />
        <span className="text-[12.5px] text-tinta-media">
          {registrados} de {total} registrados
        </span>
      </div>

      {podeRegistrar ? (
        <div className="flex gap-2">
          <BotaoEncaixar rotulo="Encaixar" className="bg-superficie" />
          <BotaoMarcarTodos miudo />
        </div>
      ) : null}
    </div>
  )
}
