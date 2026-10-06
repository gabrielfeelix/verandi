'use client'

import {
  createContext, useContext, useEffect, useOptimistic, useState, useTransition,
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
 * A tela mostra o mesmo número em quatro cantos: a etiqueta do cabeçalho, a
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
  /** a aula já começou: antes disso não há o que marcar em bloco */
  comecou: boolean
  ocupado: boolean
  registrar: (p: ParticipacaoDetalhe, status: StatusParticipacao) => void
  marcarTodos: () => void
  agir: (fn: () => Promise<void>, texto: string) => void
  /** o modal de encaixe abre do rodapé da lista e do #encaixar; o estado mora aqui */
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

/** o que o aviso diz depois do nome: "Murilo Bastos: faltou." */
const O_QUE_FICOU: Partial<Record<StatusParticipacao, string>> = {
  presente: 'veio',
  falta: 'faltou',
  falta_avisada: 'avisou que não vem',
  licenca: 'em licença',
  esperada: 'marcação removida',
  confirmada: 'confirmada',
}

const ABERTOS: ReadonlySet<StatusParticipacao> = new Set(['esperada', 'confirmada'])

export function ProvedorChamada({
  participacoes, sessaoId, podeRegistrar, inicio, children,
}: {
  participacoes: ParticipacaoDetalhe[]
  sessaoId: string
  podeRegistrar: boolean
  /** ISO do começo da aula */
  inicio: string
  children: ReactNode
}) {
  /*
   * "Marcar todos presentes" só a partir do começo. Antes aparecia em aula de
   * daqui a três dias, e um toque distraído dava presença a quem nem chegou.
   * O relógio vira sozinho na hora, sem recarregar: quem abriu a chamada cinco
   * minutos antes vê o botão aparecer quando a aula começa.
   */
  const [comecou, setComecou] = useState(() => Date.parse(inicio) <= Date.now())
  useEffect(() => {
    const falta = Date.parse(inicio) - Date.now()
    // setTimeout não aceita mais que ~24 dias; além disso, a tela recarrega antes
    if (falta <= 0 || falta > 2 ** 31 - 1) return
    const t = setTimeout(() => setComecou(true), falta)
    return () => clearTimeout(t)
  }, [inicio])
  const [pendente, iniciar] = useTransition()
  const avisar = useAviso()
  const [encaixeAberto, setEncaixe] = useState(false)
  // "Marcar" da busca de vaga chega com #encaixar: o modal abre sozinho, em
  // vez de a pessoa ter que achar e clicar o botão de novo
  useEffect(() => {
    if (window.location.hash === '#encaixar') setEncaixe(true)
  }, [])
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
    comecou,
    ocupado: pendente,
    /*
     * Tocar de novo no estado que já está marcado desmarca.
     *
     * Antes o segundo toque gravava o mesmo estado outra vez, e o "Desfazer"
     * desse aviso devolvia ao que já estava: quem testou marcou "Avisou",
     * tocou de novo para tirar, desfez, e nada mudava na tela.
     */
    registrar: (p, pedido) => iniciar(async () => {
      const status: StatusParticipacao = p.status === pedido ? 'esperada' : pedido
      aplicar({ id: p.id, status })
      // a data de volta da licença se define em Pendências: quem faz a chamada
      // quase nunca sabe, e um modal a cada licença era um toque a mais
      await mudarStatus(p.id, status)
      // desfazer, não confirmar: o registro acontece e volta atrás num toque
      avisar({
        texto: `${p.nome}: ${O_QUE_FICOU[status] ?? 'registro alterado'}.`,
        desfazer: () => iniciar(async () => {
          aplicar({ id: p.id, status: p.status })
          await mudarStatus(p.id, p.status)
        }),
      })
    }),
    marcarTodos: () => iniciar(async () => {
      aplicar({ todos: true })
      const { marcadas } = await marcarTodosPresentes(sessaoId)
      avisar({
        texto: `Chamada concluída: ${marcadas === 1 ? '1 presença' : `${marcadas} presenças`}.`,
      })
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

  return (
    <Contexto.Provider value={valor}>
      {children}
    </Contexto.Provider>
  )
}

/** O rótulo do estado, derivado da lista viva: nunca de coluna no banco. */
function estadoDe(registrados: number, total: number, comecou: boolean) {
  if (total === 0) return { rotulo: 'Sem ninguém', cor: 'bg-neutro-fundo text-tinta-media' }
  // aula que ainda não começou não tem chamada: quem avisou antes não é chamada
  // "em andamento"
  if (!comecou) return { rotulo: 'Agendada', cor: 'bg-neutro-fundo text-tinta-media' }
  if (registrados === total) {
    return { rotulo: 'Chamada feita', cor: 'bg-positivo-fundo text-positivo' }
  }
  if (registrados > 0) {
    return { rotulo: 'Chamada em andamento', cor: 'bg-atencao-fundo text-atencao' }
  }
  return { rotulo: 'Chamada pendente', cor: 'bg-alerta-fundo text-alerta' }
}

export function EtiquetaEstado({ cancelada = false }: { cancelada?: boolean }) {
  const { registrados, total, comecou } = useChamada()
  const e = cancelada
    ? { rotulo: 'Cancelada', cor: 'bg-neutro-fundo text-tinta-media' }
    : estadoDe(registrados, total, comecou)
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-peca px-2.5 py-[5px] text-[12px] font-medium ${e.cor}`}
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
  const { registrados, total, comecou } = useChamada()
  const texto = !comecou
    ? comecaEm ?? ''
    : registrados === 0
    ? ['Nenhum registro ainda', comecaEm].filter(Boolean).join(' · ')
    : `${registrados} de ${total} registrados`
  return <p className="text-[13.5px] text-tinta-media">{texto}</p>
}

/**
 * Concluir a chamada: quem ficou sem marca conta como presente.
 *
 * Um lugar por tamanho de tela: no cabeçalho a partir de `md`, na barra colada
 * no rodapé abaixo disso.
 */
export function BotaoConcluir({ miudo = false, className = '' }: { miudo?: boolean; className?: string }) {
  const { podeRegistrar, comecou, pendentes, ocupado, marcarTodos, lista } = useChamada()
  if (!podeRegistrar || !comecou || pendentes === 0) return null
  // o número diz o que o toque vai gravar: quem está sem marca vira presença
  const vieram = lista.filter((p) => p.status === 'presente' || ABERTOS.has(p.status)).length
  return (
    <button
      type="button"
      disabled={ocupado}
      onClick={marcarTodos}
      className={`cursor-pointer rounded-media bg-escuro font-semibold whitespace-nowrap text-tinta-clara transition-colors duration-150 hover:bg-escuro-hover active:translate-y-px disabled:opacity-50 ${
        miudo ? 'min-h-11 px-[18px] text-[14.5px]' : 'min-h-12 px-4 text-[14.5px]'
      } ${className}`}
    >
      Concluir chamada · {vieram} {vieram === 1 ? 'veio' : 'vieram'}
    </button>
  )
}

/**
 * Cancelar a turma inteira: só o glifo, com nome acessível.
 *
 * Fica ao lado de "encaixar" e não dentro de um menu porque é a segunda coisa
 * mais feita nesta tela quando o dia dá errado: professora doente, sala
 * interditada. Escondê-la num menu faria ligar para a recepção.
 */
export function BotaoCancelarTurma({ rotulo }: { rotulo: string }) {
  const { podeRegistrar, abrirCancelar } = useChamada()
  if (!podeRegistrar) return null
  return (
    /*
     * Com a palavra, não só o glifo.
     *
     * Era um quadrado de 44px com o sinal de proibido dentro, e ninguém
     * descobre pelo desenho se aquilo cancela a aula, bloqueia o aluno ou
     * suspende a conta: o `title` só aparece parando o mouse em cima, e no
     * celular não aparece nunca. Botão que destrói tem que dizer o que
     * destrói antes de ser clicado.
     */
    <button
      type="button"
      onClick={abrirCancelar}
      className="flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-media border border-alerta-linha bg-alerta-superficie px-3.5 text-[14.5px] font-medium text-alerta transition-colors duration-150 hover:bg-alerta-fundo"
    >
      <Icone nome="proibido" tamanho={18} />
      {rotulo}
    </button>
  )
}

export function ResumoChamada() {
  const { lista, registrados, total, comecou } = useChamada()
  // antes da aula não há chamada para resumir
  if (!comecou) return null
  const conta = (s: StatusParticipacao) => lista.filter((p) => p.status === s).length

  return (
    <section className={`${cartao} p-4`}>
      <h2 className="font-titulo text-[18px] font-semibold">Resumo da chamada</h2>
      <p className="pt-1 pb-3.5 text-[13.5px] text-tinta-media">
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
            <span className="flex-1 text-[14.5px]">{rotulo}</span>
            <span className="text-[14.5px] text-tinta-media">{n}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * A barra que não sai da tela, **só em tela estreita**.
 *
 * Numa turma longa, rolar até o fim para saber se a chamada está feita é o tipo
 * de atrito que faz voltar para a planilha. Mas o cabeçalho da sessão já traz o
 * estado e as mesmas duas ações, e em tela larga ele fica visível junto com esta
 * barra: eram dois "Marcar todos presentes" na mesma dobra, e quem clica em cima,
 * não vê a lista mudar e clica embaixo não sabe se marcou uma ou duas vezes.
 *
 * O protótipo desenha as duas ao mesmo tempo (`Verandi.dc.html`, tela `sessao`),
 * e aqui a tela diverge dele de propósito, apontado pelo Gabriel em 14/08/2026.
 * Abaixo de `md` a barra continua, porque aí o cabeçalho sai de vista assim que a
 * lista rola e ela é a única ação alcançável com o polegar.
 */
export function BarraChamada({ cancelada }: { cancelada: boolean }) {
  const { registrados, total, podeRegistrar, comecou } = useChamada()
  if (!comecou) return null
  return (
    <div className="sticky bottom-3.5 z-20 flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 rounded-grande border border-linha bg-superficie px-4 py-3 shadow-[0_16px_34px_-22px_rgba(20,26,24,.5)] md:hidden">
      <div className="flex min-w-0 items-center gap-3">
        <EtiquetaEstado cancelada={cancelada} />
        <span className="text-[13.5px] text-tinta-media">
          {registrados} de {total} registrados
        </span>
      </div>

      {podeRegistrar ? (
        <BotaoConcluir miudo />
      ) : null}
    </div>
  )
}
