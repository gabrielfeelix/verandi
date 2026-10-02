'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { Modal } from '@/components/ui/modal'
import { Nota, Vazio } from '@/components/ui/pecas'
import { useAviso } from '@/components/ui/desfazer'
import {
  agendarReposicao, aulasParaRepor, type AulaParaRepor,
} from '@/server/agenda/acoes'
import { diaDaSemanaDe } from '@/core/agenda/datas'

type Credito = {
  /** a participação da falta, que a reposição vai pagar */
  id: string
  sessaoId: string
  servicoId: string | null
  servico: string
  titulo: string
  sub: string
}

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function quando(a: AulaParaRepor) {
  return `${DIAS[diaDaSemanaDe(a.data)]} ${a.data.slice(8)}/${a.data.slice(5, 7)}, ${a.hora}`
}

/**
 * Os créditos em aberto, e o jeito de usar cada um sem sair da ficha.
 *
 * Marcar some com o crédito na hora, sem recarregar a tela: quem está no
 * balcão já sabe que deu certo pelo aviso.
 */
export function ReposicoesAbertas({
  pessoaId, creditos, podeAgendar,
}: {
  pessoaId: string
  creditos: Credito[]
  podeAgendar: boolean
}) {
  const [usados, setUsados] = useState<string[]>([])
  const [aberto, setAberto] = useState<Credito | null>(null)
  const [aulas, setAulas] = useState<AulaParaRepor[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const avisar = useAviso()

  const visiveis = creditos.filter((c) => !usados.includes(c.id))

  function abrir(c: Credito) {
    setAberto(c)
    setAulas(null)
    setErro(null)
    aulasParaRepor(c.servicoId)
      .then(setAulas)
      .catch(() => { setAulas([]); setErro('Não foi possível carregar as aulas. Tente de novo.') })
  }

  function marcar(c: Credito, a: AulaParaRepor) {
    setErro(null)
    iniciar(async () => {
      const r = await agendarReposicao(c.id, a.sessaoId, pessoaId)
      if (!r.ok) {
        setErro(
          r.motivo === 'ja_participa'
            ? 'A pessoa já está nesta aula. Escolha outra.'
            : r.motivo === 'sessao_inexistente'
              ? 'Esta aula não existe mais. Escolha outra.'
              : 'Esta aula acabou de lotar. Escolha outra.',
        )
        return
      }
      setUsados((u) => [...u, c.id])
      setAberto(null)
      avisar({ texto: `Reposição marcada: ${quando(a)}` })
    })
  }

  return (
    <>
      <div className="flex items-center justify-between pb-3">
        <h2 className="font-titulo text-[18px] font-semibold">Reposições em aberto</h2>
        <span className="flex size-6 items-center justify-center rounded-peca bg-atencao-fundo text-[13px] font-semibold text-atencao">
          {visiveis.length}
        </span>
      </div>

      {visiveis.length === 0 ? (
        <Vazio
          icone="check"
          titulo="Nenhuma. Nada a cobrar de volta."
          texto="Faltas que geraram crédito e ainda não foram repostas aparecem aqui."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {visiveis.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center gap-2.5 rounded-media border border-atencao-linha bg-superficie px-3 py-[11px]"
            >
              {/* a base de 200px é o que faz os botões descerem no celular,
                  em vez de espremerem o nome da aula até "Pilat..." */}
              <span className="flex min-w-0 flex-[1_1_200px] flex-col leading-[1.35]">
                <span className="truncate text-[14.5px] font-medium">{c.titulo}</span>
                <span className="text-[12.5px] text-tinta-fraca">{c.sub}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/sessao/${c.sessaoId}`}
                  className="rounded-peca px-2.5 py-2 text-[13.5px] text-tinta-media underline-offset-2 hover:underline"
                >
                  Ver a aula
                </Link>
                {podeAgendar ? (
                  <button
                    type="button"
                    onClick={() => abrir(c)}
                    className="cursor-pointer rounded-peca bg-atencao px-3 py-2 text-[13.5px] font-medium text-white transition-colors duration-150 hover:bg-[#75591C]"
                  >
                    Agendar reposição
                  </button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}

      {aberto ? (
        <Modal
          aberto
          glifo="↺"
          tom="atencao"
          titulo="Agendar reposição"
          sub={`Da falta em ${aberto.titulo}. Próximas duas semanas de ${aberto.servico}, só com lugar.`}
          largura="lista"
          secundario="Fechar"
          aoFechar={() => setAberto(null)}
        >
          {aulas === null ? (
            <p className="py-3 text-[14px] text-tinta-media">Procurando aulas com lugar…</p>
          ) : aulas.length === 0 && !erro ? (
            <Nota tom="atencao">
              Nenhuma aula de {aberto.servico} com lugar nas próximas duas semanas.
              Em Buscar vaga dá para ver mais adiante, ou encaixar acima da capacidade.
            </Nota>
          ) : (
            <ul className="flex flex-col gap-1.5 pb-3">
              {aulas.map((a) => (
                <li key={a.sessaoId}>
                  <button
                    type="button"
                    disabled={pendente}
                    onClick={() => marcar(aberto, a)}
                    className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-media border border-linha-suave bg-superficie px-3.5 py-2.5 text-left transition-colors duration-150 hover:bg-superficie-mais-suave disabled:cursor-wait disabled:opacity-60"
                  >
                    <span className="flex min-w-0 flex-1 flex-col leading-[1.35]">
                      <span className="text-[14.5px] font-medium">{quando(a)}</span>
                      <span className="truncate text-[12.5px] text-tinta-media">
                        {[a.profissional, a.local].filter(Boolean).join(' · ') || 'Sem registro'}
                      </span>
                    </span>
                    <span className="shrink-0 text-[13px] text-tinta-media">
                      {a.livres === 1 ? '1 lugar' : `${a.livres} lugares`}
                    </span>
                    <span className="shrink-0 text-[13.5px] font-medium text-marca">Marcar</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {erro ? <Nota tom="alerta">{erro}</Nota> : null}
        </Modal>
      ) : null}
    </>
  )
}
