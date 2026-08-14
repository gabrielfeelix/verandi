'use client'

import Link from 'next/link'
import type { StatusParticipacao } from '@/core/agenda/ocupacao'
import type { FaltaEmAberto } from '@/server/agenda/consultas'
import { GLIFO_PRESENCA, TINTA_ORIGEM, TINTA_PRESENCA } from '@/components/ui/tintas'
import { cartao, Avatar, Vazio } from '@/components/ui/pecas'
import { Icone } from '@/components/ui/icones'
import { MenuPessoa } from './menu-pessoa'
import { useChamada } from './chamada'

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
  titulo: string
  rotuloPessoa: string
  rotuloPessoas: string
  rotuloSessao: string
  /** quantas vagas livres, para o convite do rodapé da lista */
  livres: number
  /** as faltas em aberto de cada pessoa, para o "apontar reposição" */
  faltasPorPessoa: Record<string, FaltaEmAberto[]>
}

export function ListaParticipacao({
  titulo, rotuloPessoa, rotuloPessoas, rotuloSessao, livres, faltasPorPessoa,
}: Props) {
  const { lista, podeRegistrar, ocupado, registrar, agir, abrirEncaixe } = useChamada()

  return (
    <section className={`${cartao} px-2.5 pt-2 pb-3`}>
      <div className="flex items-center justify-between p-3">
        <h2 className="font-titulo text-[17px] font-semibold">{titulo}</h2>
        <span className="text-[12px] text-tinta-media">
          vaga fixa em cima, encaixes abaixo
        </span>
      </div>

      <ul className="flex flex-col gap-1.5" aria-label={rotuloPessoas}>
        {lista.map((p) => {
          const decidido = p.status !== 'esperada' && p.status !== 'confirmada'

          return (
            <li
              key={p.id}
              className={`grid grid-cols-[auto_1fr_auto] items-center gap-3.5 rounded-grande border p-3 ${
                decidido
                  ? 'border-linha-suave bg-superficie-tenue'
                  : 'border-linha-fina bg-superficie'
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

                {/* por que esta pessoa está aqui — a linha que separa quatro
                    nomes iguais em quatro situações diferentes */}
                {p.detalhe ? (
                  <span className="truncate text-[12px] text-tinta-media">{p.detalhe}</span>
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
                        disabled={ocupado}
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
              texto={`Não é erro de carregamento — é uma ${rotuloSessao.toLowerCase()} vazia.`}
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
            <span className="text-[14px] font-medium text-marca">
              {livres > 0
                ? `${livres} vaga${livres > 1 ? 's' : ''} livre${livres > 1 ? 's' : ''} — encaixar alguém`
                : 'Sem vaga livre — encaixar assim mesmo'}
            </span>
            <span className="text-[12px] text-tinta-media">
              buscar {rotuloPessoa.toLowerCase()} que já existe ou cadastrar na hora
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
      className={`rounded-minima px-1.5 py-[3px] text-[10px] font-semibold tracking-[.08em] uppercase ${cor}`}
    >
      {children}
    </span>
  )
}
