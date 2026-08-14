'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { ParticipacaoDetalhe, FaltaEmAberto } from '@/server/agenda/consultas'
import type { OrigemParticipacao } from '@/server/agenda/consultas'
import { Botao } from '@/components/ui/botao'
import { Chip, entrada, Rotulo } from '@/components/ui/pecas'
import { Icone } from '@/components/ui/icones'
import {
  apontarReposicao, salvarObservacao, trocarOrigem, removerParticipacao,
} from '@/server/agenda/acoes'

const ORIGENS: Array<{ valor: OrigemParticipacao; rotulo: string; explica: string }> = [
  { valor: 'recorrente', rotulo: 'Fixo', explica: 'tem vaga permanente neste horário' },
  { valor: 'avulso', rotulo: 'Avulso', explica: 'veio só desta vez' },
  { valor: 'reposicao', rotulo: 'Reposição', explica: 'está repondo uma falta' },
  { valor: 'encaixe', rotulo: 'Encaixe', explica: 'entrou fora da capacidade prevista' },
  { valor: 'reserva', rotulo: 'Reserva', explica: 'espera vaga abrir' },
]

type Aberto = null | 'menu' | 'observacao' | 'reposicao' | 'origem'

/**
 * O menu por pessoa da tela de Sessão.
 *
 * As quatro ações que ele abre — observação, apontar reposição, trocar origem e
 * remover — o modelo já aguentava desde a primeira migration; o que faltava era
 * a tela expor. Apontar reposição é o `REP 05/6` da planilha virando dado.
 */
export function MenuPessoa({
  participacao, faltas, aoAgir, pendente,
}: {
  participacao: ParticipacaoDetalhe
  /** as faltas em aberto desta pessoa, carregadas no servidor */
  faltas: FaltaEmAberto[]
  aoAgir: (fn: () => Promise<void>, texto: string) => void
  pendente: boolean
}) {
  const [aberto, setAberto] = useState<Aberto>(null)
  const [texto, setTexto] = useState(participacao.observacao ?? '')
  const [visivel, setVisivel] = useState(participacao.observacaoVisivel)
  const caixa = useRef<HTMLDivElement>(null)

  // clicar fora fecha: menu que só fecha no próprio botão é menu que fica aberto
  useEffect(() => {
    if (aberto !== 'menu') return
    function fora(e: MouseEvent) {
      if (!caixa.current?.contains(e.target as Node)) setAberto(null)
    }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [aberto])

  function fechar() {
    setAberto(null)
  }

  return (
    <div ref={caixa} className="relative">
      <button
        type="button"
        aria-label="Mais ações"
        title={`Mais ações de ${participacao.nome}`}
        aria-expanded={aberto !== null}
        disabled={pendente}
        onClick={() => setAberto(aberto === 'menu' ? null : 'menu')}
        className="flex size-11 cursor-pointer items-center justify-center rounded-peca text-tinta-media transition-colors duration-150 hover:bg-superficie-mais-suave hover:text-tinta md:size-[34px]"
      >
        <Icone nome="kebab" />
      </button>

      {aberto === 'menu' ? (
        <div className="absolute top-[38px] right-0 z-[25] flex w-[216px] flex-col gap-0.5 rounded-grande border border-linha-suave bg-superficie p-1.5 shadow-elevado">
          <Link
            href={`/pessoas/${participacao.pessoaId}`}
            className="rounded-peca px-3 py-2.5 text-[13px] hover:bg-superficie-suave"
          >
            Ver ficha completa
          </Link>
          {/* restrita e não é para estes olhos: o item some, em vez de abrir
              uma caixa vazia que apagaria o que o profissional anotou */}
          {participacao.observacaoRestrita ? (
            <span className="px-3 py-2.5 text-[13px] text-tinta-fraca">
              Observação de quem atende
            </span>
          ) : (
            <ItemMenu onClick={() => setAberto('observacao')}>
              {participacao.observacao ? 'Editar observação' : 'Escrever observação'}
            </ItemMenu>
          )}
          <ItemMenu onClick={() => setAberto('reposicao')}>
            {participacao.reposicaoDeId ? 'Trocar a falta reposta' : 'Apontar reposição'}
          </ItemMenu>
          <ItemMenu onClick={() => setAberto('origem')}>Trocar origem</ItemMenu>
          <ItemMenu
            perigo
            onClick={() => {
              fechar()
              aoAgir(
                () => removerParticipacao(participacao.id),
                `${participacao.nome} saiu deste horário`,
              )
            }}
          >
            Remover
          </ItemMenu>
        </div>
      ) : null}

      {aberto === 'observacao' ? (
        <Gaveta titulo={`Observação sobre ${participacao.nome}`} aoFechar={fechar}>
          <textarea
            autoFocus
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={3}
            className={`${entrada} w-full py-2`}
            placeholder="chegou atrasada, saiu mais cedo…"
          />
          {/* quem escreve escolhe quem lê, na hora de escrever: é o único
              momento em que a pessoa sabe se está anotando "chegou atrasada" ou
              "lesão no ombro". O padrão fecha, e é decisão, não descuido */}
          <div className="flex flex-col gap-1.5">
            <Rotulo>Visível para</Rotulo>
            <div className="flex flex-wrap gap-1.5">
              <Chip
                ativo={visivel === 'profissionais'}
                onClick={() => setVisivel('profissionais')}
              >
                Só quem atende
              </Chip>
              <Chip ativo={visivel === 'todos'} onClick={() => setVisivel('todos')}>
                Todo mundo da conta
              </Chip>
            </div>
            <p className="text-[11.5px] text-tinta-media">
              {visivel === 'profissionais'
                ? 'A recepção não lê. É onde vai o que é de saúde.'
                : 'Aparece para quem abrir esta tela, inclusive a recepção.'}
            </p>
          </div>
          <div className="flex gap-2">
            <Botao
              miudo
              disabled={pendente}
              onClick={() => {
                fechar()
                aoAgir(
                  () => salvarObservacao(participacao.id, texto, visivel),
                  'Observação salva',
                )
              }}
            >
              Salvar
            </Botao>
            <Botao tom="fantasma" miudo onClick={fechar}>Cancelar</Botao>
          </div>
        </Gaveta>
      ) : null}

      {aberto === 'reposicao' ? (
        <Gaveta titulo={`Qual falta ${participacao.nome} está repondo?`} aoFechar={fechar}>
          {faltas.length === 0 ? (
            <p className="text-[12.5px] text-tinta-media">
              Nenhuma falta em aberto no prazo. Sem crédito para repor, isto
              provavelmente é um avulso ou um encaixe.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {faltas.map((f) => (
                <li key={f.participacaoId}>
                  <button
                    type="button"
                    disabled={pendente}
                    onClick={() => {
                      fechar()
                      aoAgir(
                        () => apontarReposicao(participacao.id, f.participacaoId),
                        'Reposição apontada',
                      )
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-padrao border px-3 py-2.5 text-left text-[13px] hover:bg-superficie-suave ${
                      participacao.reposicaoDeId === f.participacaoId
                        ? 'border-marca bg-positivo-superficie'
                        : 'border-linha-suave'
                    }`}
                  >
                    <span className="font-mono text-[12px] text-tinta-media">
                      {f.data.slice(8)}/{f.data.slice(5, 7)}
                    </span>
                    <span className="flex-1">{f.servico}</span>
                    <span className="text-[11.5px] text-tinta-media">
                      {f.status === 'falta' ? 'faltou' : 'avisou'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {participacao.reposicaoDeId ? (
            <Botao
              tom="fantasma"
              miudo
              disabled={pendente}
              onClick={() => {
                fechar()
                aoAgir(
                  () => apontarReposicao(participacao.id, null),
                  'Reposição desfeita, a falta volta a contar como crédito',
                )
              }}
            >
              Desfazer o apontamento
            </Botao>
          ) : null}
        </Gaveta>
      ) : null}

      {aberto === 'origem' ? (
        <Gaveta titulo={`De onde ${participacao.nome} veio`} aoFechar={fechar}>
          <ul className="flex flex-col gap-1.5">
            {ORIGENS.map((o) => (
              <li key={o.valor}>
                <button
                  type="button"
                  disabled={pendente}
                  onClick={() => {
                    fechar()
                    aoAgir(
                      () => trocarOrigem(participacao.id, o.valor),
                      `Agora consta como ${o.rotulo.toLowerCase()}`,
                    )
                  }}
                  className={`flex w-full flex-col rounded-padrao border px-3 py-2 text-left hover:bg-superficie-suave ${
                    participacao.origem === o.valor
                      ? 'border-marca bg-positivo-superficie'
                      : 'border-linha-suave'
                  }`}
                >
                  <span className="text-[13px] font-medium">{o.rotulo}</span>
                  <span className="text-[11.5px] text-tinta-media">{o.explica}</span>
                </button>
              </li>
            ))}
          </ul>
        </Gaveta>
      ) : null}
    </div>
  )
}

function ItemMenu({
  children, perigo = false, onClick,
}: {
  children: React.ReactNode
  perigo?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-peca px-3 py-2.5 text-left text-[13px] hover:bg-superficie-suave ${
        perigo ? 'text-alerta' : ''
      }`}
    >
      {children}
    </button>
  )
}

/** O painel que sai do menu, ancorado na linha da pessoa. */
function Gaveta({
  titulo, aoFechar, children,
}: {
  titulo: string
  aoFechar: () => void
  children: React.ReactNode
}) {
  return (
    <div
      role="dialog"
      aria-label={titulo}
      className="absolute top-11 right-0 z-30 flex w-80 flex-col gap-2.5 rounded-grande border border-linha-suave bg-superficie p-3.5 shadow-elevado"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-[13px] font-medium">{titulo}</span>
        <button
          type="button"
          aria-label="Fechar"
          onClick={aoFechar}
          className="-mt-1 -mr-1 flex size-8 items-center justify-center rounded-peca text-tinta-media hover:bg-superficie-suave"
        >
          <span aria-hidden>×</span>
        </button>
      </div>
      {children}
    </div>
  )
}
