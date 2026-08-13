'use client'

import Link from 'next/link'
import { useOptimistic, useState, useTransition } from 'react'
import type { ParticipacaoDetalhe } from '@/server/agenda/consultas'
import type { StatusParticipacao } from '@/core/agenda/ocupacao'
import { marcarTodosPresentes, mudarStatus } from '@/server/agenda/acoes'
import type { FaltaEmAberto } from '@/server/agenda/consultas'
import { useAviso } from '@/components/ui/desfazer'
import { GLIFO_PRESENCA, TINTA_ORIGEM, TINTA_PRESENCA } from '@/components/ui/tintas'
import { cartao, Avatar, Vazio } from '@/components/ui/pecas'
import { Icone } from '@/components/ui/icones'
import { MenuPessoa } from './menu-pessoa'

/**
 * Os quatro estados, como botões de 44px.
 *
 * O protótipo desenha 34px de altura. Esta tela é usada em pé, numa sala, com a
 * mão ocupada — 44px é o mínimo do alvo de toque, e aqui isso ganha do desenho.
 */
const STATUS: Array<{
  valor: StatusParticipacao; curto: string; titulo: string; glifo: string
}> = [
  { valor: 'presente',      curto: 'Veio',    titulo: 'Presente',                              glifo: '✓' },
  { valor: 'falta',         curto: 'Faltou',  titulo: 'Faltou sem avisar',                     glifo: '×' },
  { valor: 'falta_avisada', curto: 'Avisou',  titulo: 'Avisou que não vem — libera a vaga',    glifo: '!' },
  { valor: 'licenca',       curto: 'Licença', titulo: 'Afastado, mantém o horário',            glifo: '~' },
]

const TINTA_BOTAO: Record<StatusParticipacao, string> = {
  presente: 'border-positivo-fundo bg-positivo-fundo text-positivo',
  falta: 'border-alerta-fundo bg-alerta-fundo text-alerta',
  falta_avisada: 'border-atencao-fundo bg-atencao-fundo text-atencao',
  licenca: 'border-licenca-fundo bg-licenca-fundo text-licenca',
  esperada: '',
  confirmada: '',
  cancelada: '',
}

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
  rotuloSessao: string
  /** as faltas em aberto de cada pessoa, para o "apontar reposição" */
  faltasPorPessoa: Record<string, FaltaEmAberto[]>
}

export function ListaParticipacao({
  participacoes, sessaoId, podeRegistrar, rotuloPessoas, rotuloSessao,
  faltasPorPessoa,
}: Props) {
  const [pendente, iniciar] = useTransition()
  const avisar = useAviso()
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

  /** Toda ação de menu passa por aqui: aplica, avisa, e a tela recarrega. */
  function agir(fn: () => Promise<void>, texto: string) {
    iniciar(async () => {
      await fn()
      avisar({ texto })
    })
  }

  return (
    <section className={`${cartao} px-2.5 pt-2 pb-3`}>
      <div className="flex items-center justify-between p-3">
        <h2 className="font-titulo text-[17px] font-semibold">
          {rotuloPessoas} nesta {rotuloSessao.toLowerCase()}
        </h2>
        <span className="text-[12px] text-tinta-media">
          vaga fixa em cima, encaixes abaixo
        </span>
      </div>

      {podeRegistrar && pendentes > 0 ? (
        <div className="px-1.5 pb-2">
          <button
            type="button"
            disabled={pendente}
            onClick={() => iniciar(async () => {
              aplicar({ todos: true })
              const { marcadas } = await marcarTodosPresentes(sessaoId)
              avisar({ texto: `${marcadas} marcada(s) como presente` })
            })}
            className="min-h-12 w-full rounded-padrao bg-escuro px-4 text-[14px] font-semibold text-tinta-clara hover:bg-escuro-hover active:translate-y-px"
          >
            Marcar todos presentes ({pendentes})
          </button>
        </div>
      ) : null}

      {desfazer ? (
        <p role="status" className="px-3 pb-2 text-[12.5px] text-tinta-media">
          {desfazer.nome} atualizado.{' '}
          <button
            type="button"
            className="font-medium text-marca underline"
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

      <ul className="flex flex-col gap-1.5" aria-label={rotuloPessoas}>
        {lista.map((p) => {
          const decidido = p.status !== 'esperada' && p.status !== 'confirmada'
          const detalhe = [
            p.reposicaoDeId ? 'repõe uma falta' : null,
            p.observacao,
          ].filter(Boolean).join(' · ')

          return (
            <li
              key={p.id}
              className={`grid grid-cols-[auto_1fr_auto] items-center gap-3.5 rounded-grande border p-3 ${
                p.origem === 'recorrente'
                  ? 'border-linha-suave bg-superficie'
                  : 'border-linha-fina bg-superficie-suave'
              }`}
            >
              {/* o nome está escrito ao lado; o avatar aqui é reconhecimento */}
              <Avatar
                nome={p.nome}
                tamanho={40}
                decorativo
                selo={
                  decidido
                    ? { tinta: TINTA_PRESENCA[p.status], glifo: GLIFO_PRESENCA[p.status] }
                    : undefined
                }
              />

              <span className="flex min-w-0 flex-col gap-1.5">
                <span className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/pessoas/${p.pessoaId}`}
                    className="text-[15px] font-medium hover:text-marca"
                  >
                    {p.nome}
                  </Link>

                  {/* origem distinguível de relance: quem tem lugar fixo e quem
                      entrou de encaixe são situações diferentes para quem dá a aula */}
                  <Marca tinta={TINTA_ORIGEM[p.origem]}>{ORIGEM[p.origem] ?? p.origem}</Marca>

                  {p.tags.map((t) => (
                    <Marca key={t} tinta="atencao">{t}</Marca>
                  ))}

                  {p.telefone === null ? (
                    <Marca tinta="neutro" titulo="Sem telefone cadastrado">
                      sem telefone
                    </Marca>
                  ) : null}
                </span>

                {detalhe ? (
                  <span className="truncate text-[12px] text-tinta-media">{detalhe}</span>
                ) : null}
              </span>

              <span className="flex items-center gap-2">
                {podeRegistrar ? (
                  <span className="flex gap-1.5">
                    {STATUS.map((s) => (
                      <button
                        key={s.valor}
                        type="button"
                        title={s.titulo}
                        // o nome curto é o nome acessível; o longo fica no
                        // `title`. Pôr o nome da pessoa aqui faria cada busca
                        // por nome casar com meia dúzia de botões — o contexto
                        // já vem do item da lista
                        aria-label={s.curto}
                        disabled={pendente}
                        aria-pressed={p.status === s.valor}
                        onClick={() => registrar(p, s.valor)}
                        className={`flex h-11 w-11 items-center justify-center rounded-padrao border text-[15px] ${
                          p.status === s.valor
                            ? TINTA_BOTAO[s.valor]
                            : 'border-linha bg-superficie text-tinta-media hover:border-[#B7C4BF]'
                        }`}
                      >
                        <span aria-hidden>{s.glifo}</span>
                      </button>
                    ))}
                  </span>
                ) : (
                  <span className="text-[12.5px] text-tinta-media">{p.status}</span>
                )}

                <MenuPessoa
                  participacao={p}
                  faltas={faltasPorPessoa[p.pessoaId] ?? []}
                  pendente={pendente}
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
              texto={`Não é erro de carregamento — é uma ${rotuloSessao.toLowerCase()} vazia.`}
            />
          </li>
        ) : null}
      </ul>

      {podeRegistrar ? (
        <a
          href="#encaixar"
          className="mt-1.5 flex items-center gap-3 rounded-grande border border-dashed border-linha-tracejada p-3.5 hover:bg-superficie-suave"
        >
          <span
            aria-hidden
            className="flex size-10 items-center justify-center rounded-full border border-dashed border-linha-tracejada text-tinta-media"
          >
            <Icone nome="mais" />
          </span>
          <span className="flex flex-col">
            <span className="text-[14px] font-medium text-marca">
              Encaixar alguém neste horário
            </span>
            <span className="text-[12px] text-tinta-media">
              buscar quem já existe ou cadastrar na hora
            </span>
          </span>
        </a>
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
      className={`rounded-minima px-1.5 py-[3px] text-[10px] font-semibold tracking-[.08em] uppercase ${cor}`}
    >
      {children}
    </span>
  )
}
