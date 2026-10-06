'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { StatusParticipacao } from '@/core/agenda/ocupacao'
import type { FaltaEmAberto } from '@/server/agenda/consultas'
import { cartao, Avatar, Vazio } from '@/components/ui/pecas'
import { Icone } from '@/components/ui/icones'
import { MenuPessoa } from './menu-pessoa'
import { useChamada } from './chamada'

/**
 * O que cada aluno pode virar, e quando.
 *
 * Antes da aula não existe falta: a recepção só registra a falta justificada
 * (libera a vaga e gera reposição) ou a licença. Depois que a aula começa,
 * quem está sem marca aparece como "Presente", provisório, e vira presença
 * ao concluir a chamada. Assim a turma cheia se fecha num toque, e só a
 * exceção pede atenção. Alvo de 44px: a tela é usada em pé, com a mão ocupada.
 */
const MOTIVOS: Array<{
  valor: StatusParticipacao; rotulo: string; explica: string; soDepois?: boolean
}> = [
  { valor: 'falta',         rotulo: 'Falta',             explica: 'Ausência sem aviso prévio', soDepois: true },
  { valor: 'falta_avisada', rotulo: 'Falta justificada', explica: 'Libera a vaga e gera reposição' },
  { valor: 'licenca',       rotulo: 'Licença',           explica: 'Afastamento, mantém o horário fixo' },
]

/** o rótulo do botão em cada estado, e o que a tela só de leitura mostra */
const CURTO: Partial<Record<StatusParticipacao, string>> = {
  presente: 'Presente',
  falta: 'Falta',
  falta_avisada: 'Falta justificada',
  licenca: 'Licença',
}

const NAO_VEIO: ReadonlySet<StatusParticipacao> = new Set(['falta', 'falta_avisada', 'licenca'])

/*
 * Cor sólida com texto branco: o estado registrado é um botão, e pastel em
 * botão parecia etiqueta. Pastel fica só no que não se clica. Todos os pares
 * passam AA com o branco (5,1 a 6,7:1). Tokens `reg-*` em globals.css.
 */
const TINTA_BOTAO: Partial<Record<StatusParticipacao, string>> = {
  presente: 'border-reg-presente bg-reg-presente text-white hover:bg-reg-presente-forte',
  falta: 'border-reg-falta bg-reg-falta text-white hover:bg-reg-falta-forte',
  falta_avisada: 'border-reg-justificada bg-reg-justificada text-white hover:bg-reg-justificada-forte',
  licenca: 'border-reg-licenca bg-reg-licenca text-white hover:bg-reg-licenca-forte',
}

type Props = {
  titulo: string
  rotuloPessoa: string
  rotuloPessoas: string
  /** quantas vagas livres, para o convite do rodapé da lista */
  livres: number
  /** as faltas em aberto de cada pessoa, para o "apontar reposição" */
  faltasPorPessoa: Record<string, FaltaEmAberto[]>
}

export function ListaParticipacao({
  titulo, rotuloPessoa, rotuloPessoas, livres, faltasPorPessoa,
}: Props) {
  const {
    lista, podeRegistrar, ocupado, registrar, agir, abrirEncaixe, pendentes, comecou,
  } = useChamada()

  return (
    <section className={`${cartao} px-2.5 pt-2 pb-3`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 p-3">
        <h2 className="font-titulo text-[18px] font-semibold">{titulo}</h2>
        {/* só o aviso que muda o resultado; "vaga fixa em cima, encaixes
            abaixo" explicava a ordem da lista, que se vê olhando */}
        {podeRegistrar && comecou && pendentes > 0 ? (
          <span className="text-[13.5px] text-tinta-media">
            quem não for marcado conta como presente
          </span>
        ) : null}
      </div>

      <ul className="flex flex-col gap-1.5" aria-label={rotuloPessoas}>
        {lista.map((p) => {
          const decidido = p.status !== 'esperada' && p.status !== 'confirmada'

          return (
            <li
              key={p.id}
              className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2.5 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] rounded-grande border p-3 sm:gap-x-3.5 ${
                decidido
                  ? 'border-linha-suave bg-superficie-tenue'
                  : 'border-linha-fina bg-superficie'
              }`}
            >
              {/* o nome está escrito ao lado; o avatar aqui é reconhecimento */}
              {/* no celular o nome precisa da largura; o estado já está no botão */}
              <span className="max-sm:hidden">
                {/* sem selo de estado: o botão ao lado já diz, em cor sólida */}
                <Avatar nome={p.nome} tamanho={40} decorativo />
              </span>

              <span className="flex min-w-0 flex-col gap-1.5">
                <span className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/pessoas/${p.pessoaId}`}
                    className="text-[16px] font-medium hover:text-marca"
                  >
                    {p.nome}
                  </Link>

                  {p.tags.map((t) => (
                    <Marca key={t} tinta="atencao">{t}</Marca>
                  ))}

                  {p.telefone === null ? (
                    <Marca tinta="neutro" titulo="Sem telefone cadastrado">
                      sem telefone
                    </Marca>
                  ) : null}
                </span>

                {/* por que esta pessoa está aqui (horário fixo, avulsa,
                    encaixe, reposição): a etiqueta de origem repetia isto */}
                {p.detalhe ? (
                  <span className="truncate text-[13.5px] text-tinta-media">{p.detalhe}</span>
                ) : null}
              </span>

              {podeRegistrar ? (
                <Presenca
                  status={p.status}
                  nome={p.nome}
                  comecou={comecou}
                  ocupado={ocupado}
                  aoEscolher={(status) => registrar(p, status)}
                  // antes da aula, desfazer devolve à aula; depois, a pessoa
                  // veio, e é isso que fica
                  aoDesfazer={() => registrar(p, comecou ? 'presente' : 'esperada')}
                />
              ) : (
                <span className="text-[13.5px] text-tinta-media max-sm:col-span-2 max-sm:row-start-2 max-sm:mt-1">
                  {CURTO[p.status] ?? 'Sem registro'}
                </span>
              )}

              {/* no celular o estado desce para a linha de baixo, na largura
                  toda, e o "⋮" fica ao lado do nome */}
              <span className="max-sm:col-start-2 max-sm:row-start-1">
                <MenuPessoa
                  participacao={p}
                  faltas={faltasPorPessoa[p.pessoaId] ?? []}
                  pendente={ocupado}
                  aoAgir={agir}
                />
              </span>
            </li>
          )
        })}

        {lista.length === 0 ? (
          <li>
            <Vazio
              icone="pessoas"
              titulo="Ninguém marcado ainda"
              texto="Não é erro de carregamento. O horário existe e ainda não tem ninguém."
            />
          </li>
        ) : null}
      </ul>

      {podeRegistrar ? (
        <button
          type="button"
          onClick={abrirEncaixe}
          className="mt-1.5 flex w-full cursor-pointer items-center gap-3 rounded-grande border border-dashed border-linha-tracejada p-3.5 text-left transition-colors duration-150 hover:bg-superficie-suave"
        >
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-dashed border-linha-tracejada text-tinta-media"
          >
            <Icone nome="mais" />
          </span>
          <span className="flex flex-col">
            <span className="text-[14.5px] font-medium text-marca">
              Encaixar {rotuloPessoa.toLowerCase()}
            </span>
            <span className="text-[13.5px] text-tinta-media">
              {livres > 0
                ? `${livres} ${livres > 1 ? 'vagas livres' : 'vaga livre'}`
                : 'Sem vaga livre'}
            </span>
          </span>
        </button>
      ) : null}
    </section>
  )
}

/** A marca miúda de 10px em versalete que o protótipo usa na linha da pessoa. */
function Marca({
  tinta, titulo, children,
}: {
  tinta: 'positivo' | 'atencao' | 'alerta' | 'info' | 'licenca' | 'neutro'
  titulo?: string
  children: React.ReactNode
}) {
  const cor = {
    positivo: 'bg-positivo-fundo text-positivo',
    atencao: 'bg-atencao-fundo text-atencao',
    alerta: 'bg-alerta-fundo text-alerta',
    info: 'bg-info-fundo text-info',
    licenca: 'bg-licenca-fundo text-licenca',
    neutro: 'bg-neutro-fundo text-tinta-media',
  }[tinta]
  return (
    <span
      title={titulo}
      className={`rounded-minima px-1.5 py-[3px] text-[12px] font-semibold ${cor}`}
    >
      {children}
    </span>
  )
}

/**
 * O estado do aluno como um botão só, que abre o que ele pode virar.
 *
 * O rótulo é sempre o estado atual ("Agendado", "Presente", "Falta"...), então
 * a tela responde de relance quem veio sem ninguém precisar tocar. "Presente"
 * provisório tem borda tracejada; firma ao concluir a chamada.
 */
function Presenca({
  status, nome, comecou, ocupado, aoEscolher, aoDesfazer,
}: {
  status: StatusParticipacao
  nome: string
  comecou: boolean
  ocupado: boolean
  aoEscolher: (s: StatusParticipacao) => void
  aoDesfazer: () => void
}) {
  const [aberto, setAberto] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)
  const faltou = NAO_VEIO.has(status)
  const semMarca = status === 'esperada' || status === 'confirmada'
  const provisorio = semMarca && comecou
  const primeiro = nome.split(' ')[0]

  // clicar fora ou apertar Esc fecha
  useEffect(() => {
    if (!aberto) return
    function fora(e: MouseEvent) {
      if (!caixa.current?.contains(e.target as Node)) setAberto(false)
    }
    function esc(e: KeyboardEvent) {
      if (e.key === 'Escape') setAberto(false)
    }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('keydown', esc)
    }
  }, [aberto])

  function escolher(fn: () => void) {
    setAberto(false)
    fn()
  }

  const rotulo = semMarca ? (comecou ? 'Presente' : 'Agendado') : (CURTO[status] ?? 'Agendado')
  const tinta = provisorio
    ? 'border-dashed border-positivo/45 bg-superficie text-positivo'
    : semMarca
      ? 'border-linha bg-superficie text-tinta-media hover:border-[#B7C4BF] hover:text-tinta'
      : TINTA_BOTAO[status] ?? ''
  const motivos = MOTIVOS.filter((m) => comecou || !m.soDepois || m.valor === status)

  return (
    <div ref={caixa} className="relative max-sm:col-span-2 max-sm:row-start-2 max-sm:mt-2.5">
      <button
        type="button"
        disabled={ocupado}
        aria-expanded={aberto}
        aria-haspopup="menu"
        title={provisorio ? 'Conta como presente ao concluir a chamada' : `Mudar o registro de ${primeiro}`}
        onClick={() => setAberto(!aberto)}
        className={`flex h-11 min-w-[124px] max-sm:w-full cursor-pointer items-center justify-between gap-1.5 rounded-padrao border px-3 text-[14.5px] font-medium whitespace-nowrap transition-colors duration-150 disabled:opacity-60 ${tinta}`}
      >
        <span className="flex items-center gap-1.5">
          {status === 'presente' || provisorio ? <span aria-hidden>✓</span> : null}
          {rotulo}
        </span>
        <Icone nome="abaixo" tamanho={14} />
      </button>

      {aberto ? (
        <>
        {/* no celular o menu sobe como folha no rodapé: aberto no meio da
            lista, ele caía atrás da barra da chamada */}
        <div aria-hidden className="fixed inset-0 z-[40] bg-black/25 sm:hidden" />
        <div
          role="menu"
          className="fixed inset-x-3 bottom-3 z-[41] flex flex-col gap-0.5 rounded-grande border border-linha-suave bg-superficie p-2 shadow-elevado sm:absolute sm:inset-x-auto sm:top-[48px] sm:right-0 sm:bottom-auto sm:z-[25] sm:w-[240px] sm:p-1.5"
        >
          <p className="px-3 pt-1.5 pb-1 text-[13.5px] text-tinta-media sm:hidden">{nome}</p>
          {motivos.map((m) => (
            <button
              key={m.valor}
              type="button"
              role="menuitemradio"
              aria-checked={status === m.valor}
              onClick={() => escolher(() => {
                if (status !== m.valor) aoEscolher(m.valor)
              })}
              className={`flex cursor-pointer flex-col rounded-peca px-3 py-2.5 text-left hover:bg-superficie-suave ${
                status === m.valor ? 'bg-superficie-suave' : ''
              }`}
            >
              <span className="text-[14.5px] font-medium">{m.rotulo}</span>
              <span className="text-[12px] text-tinta-media">{m.explica}</span>
            </button>
          ))}
          {faltou ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => escolher(aoDesfazer)}
              className="mt-0.5 cursor-pointer rounded-peca border-t border-linha-suave px-3 py-2.5 text-left text-[14.5px] text-tinta-media hover:bg-superficie-suave"
            >
              {comecou ? 'Desfazer, marcar presente' : 'Desfazer, manter agendado'}
            </button>
          ) : null}
        </div>
        </>
      ) : null}
    </div>
  )
}
