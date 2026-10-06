'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { StatusParticipacao } from '@/core/agenda/ocupacao'
import type { FaltaEmAberto } from '@/server/agenda/consultas'
import { GLIFO_PRESENCA, TINTA_ORIGEM, TINTA_PRESENCA } from '@/components/ui/tintas'
import { cartao, Avatar, Vazio } from '@/components/ui/pecas'
import { Icone } from '@/components/ui/icones'
import { MenuPessoa } from './menu-pessoa'
import { useChamada } from './chamada'

/**
 * O que cada aluno pode virar, e quando.
 *
 * Antes da aula ninguém "faltou": a recepção só registra quem avisou que não
 * vem (libera a vaga e gera reposição) ou entrou de licença. Depois que a aula
 * começa, quem está sem marca aparece como "Veio", provisório, e vira presença
 * ao concluir a chamada. Assim a turma cheia se fecha num toque, e só a
 * exceção pede atenção. Alvo de 44px: a tela é usada em pé, com a mão ocupada.
 */
const MOTIVOS: Array<{
  valor: StatusParticipacao; rotulo: string; explica: string; soDepois?: boolean
}> = [
  { valor: 'falta',         rotulo: 'Faltou sem avisar',   explica: 'Não veio e não avisou', soDepois: true },
  { valor: 'falta_avisada', rotulo: 'Avisou que não vem',  explica: 'Libera a vaga e gera reposição' },
  { valor: 'licenca',       rotulo: 'Licença',             explica: 'Afastado, mantém o horário' },
]

/** o rótulo do botão em cada estado, e o que a tela só de leitura mostra */
const CURTO: Partial<Record<StatusParticipacao, string>> = {
  presente: 'Veio',
  falta: 'Faltou',
  falta_avisada: 'Avisou',
  licenca: 'Licença',
}

const NAO_VEIO: ReadonlySet<StatusParticipacao> = new Set(['falta', 'falta_avisada', 'licenca'])

const TINTA_BOTAO: Partial<Record<StatusParticipacao, string>> = {
  presente: 'border-positivo-fundo bg-positivo-fundo text-positivo',
  falta: 'border-alerta-fundo bg-alerta-fundo text-alerta',
  falta_avisada: 'border-atencao-fundo bg-atencao-fundo text-atencao',
  licenca: 'border-licenca-fundo bg-licenca-fundo text-licenca',
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
      <div className="flex items-center justify-between p-3">
        <h2 className="font-titulo text-[18px] font-semibold">{titulo}</h2>
        <span className="text-[13px] text-tinta-media">
          {podeRegistrar && comecou && pendentes > 0
            ? 'quem não for marcado conta como presente'
            : 'vaga fixa em cima, encaixes abaixo'}
        </span>
      </div>

      <ul className="flex flex-col gap-1.5" aria-label={rotuloPessoas}>
        {lista.map((p) => {
          const decidido = p.status !== 'esperada' && p.status !== 'confirmada'

          return (
            <li
              key={p.id}
              className={`grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-2.5 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] rounded-grande border p-3 sm:gap-x-3.5 ${
                decidido
                  ? 'border-linha-suave bg-superficie-tenue'
                  : 'border-linha-fina bg-superficie'
              }`}
            >
              {/* o nome está escrito ao lado; o avatar aqui é reconhecimento */}
              {/* no celular o nome precisa da largura; o estado já está no botão */}
              <span className="max-sm:hidden">
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
              </span>

              <span className="flex min-w-0 flex-col gap-1.5">
                <span className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/pessoas/${p.pessoaId}`}
                    className="text-[16px] font-medium hover:text-marca"
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

                {/* por que esta pessoa está aqui, a linha que separa quatro
                    nomes iguais em quatro situações diferentes */}
                {p.detalhe ? (
                  <span className="truncate text-[13px] text-tinta-media">{p.detalhe}</span>
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
                <span className="text-[13.5px] text-tinta-media">
                  {CURTO[p.status] ?? 'Sem registro'}
                </span>
              )}

              <span>
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
            <span className="text-[15px] font-medium text-marca">
              {livres > 0
                ? `${livres} vaga${livres > 1 ? 's' : ''} livre${livres > 1 ? 's' : ''}, encaixar alguém`
                : 'Sem vaga livre, encaixar assim mesmo'}
            </span>
            <span className="text-[13px] text-tinta-media">
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
      className={`rounded-minima px-1.5 py-[3px] text-[11.5px] font-semibold tracking-[.08em] uppercase ${cor}`}
    >
      {children}
    </span>
  )
}

/**
 * O estado do aluno como um botão só, que abre o que ele pode virar.
 *
 * O rótulo é sempre o estado atual ("Agendado", "Veio", "Avisou"...), então a
 * tela responde de relance quem veio sem ninguém precisar tocar. "Veio"
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

  const rotulo = semMarca ? (comecou ? 'Veio' : 'Agendado') : (CURTO[status] ?? 'Agendado')
  const tinta = provisorio
    ? 'border-dashed border-positivo/45 bg-superficie text-positivo'
    : semMarca
      ? 'border-linha bg-superficie text-tinta-media hover:border-[#B7C4BF] hover:text-tinta'
      : TINTA_BOTAO[status] ?? ''
  const motivos = MOTIVOS.filter((m) => comecou || !m.soDepois || m.valor === status)

  return (
    <div ref={caixa} className="relative">
      <button
        type="button"
        disabled={ocupado}
        aria-expanded={aberto}
        aria-haspopup="menu"
        title={provisorio ? 'Conta como presente ao concluir a chamada' : `Mudar o registro de ${primeiro}`}
        onClick={() => setAberto(!aberto)}
        className={`flex h-11 min-w-[112px] cursor-pointer items-center justify-between gap-1.5 rounded-padrao border px-3 text-[14px] font-medium whitespace-nowrap transition-colors duration-150 disabled:opacity-60 ${tinta}`}
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
          <p className="px-3 pt-1.5 pb-1 text-[13px] text-tinta-media sm:hidden">{nome}</p>
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
              <span className="text-[12.5px] text-tinta-media">{m.explica}</span>
            </button>
          ))}
          {faltou ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => escolher(aoDesfazer)}
              className="mt-0.5 cursor-pointer rounded-peca border-t border-linha-suave px-3 py-2.5 text-left text-[14px] text-tinta-media hover:bg-superficie-suave"
            >
              {comecou ? `Desfazer, ${primeiro} veio` : `Desfazer, ${primeiro} vem`}
            </button>
          ) : null}
        </div>
        </>
      ) : null}
    </div>
  )
}
