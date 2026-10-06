'use client'

import { useState, useTransition } from 'react'
import { Modal } from '@/components/ui/modal'
import { Botao } from '@/components/ui/botao'
import { Chip, Nota, entrada } from '@/components/ui/pecas'
import { useAviso } from '@/components/ui/desfazer'
import {
  agendarReposicao, aulasParaRepor, encaixar, type AulaParaRepor,
} from '@/server/agenda/acoes'
import { diaDaSemanaDe } from '@/core/agenda/datas'
import { semAcento } from '@/core/pessoas/busca'

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

/** uma falta que esta marcação pode pagar */
export type FaltaParaRepor = { id: string; quando: string }

type Servico = { id: string; nome: string }

function diaPorExtenso(data: string) {
  return `${DIAS[diaDaSemanaDe(data)]}, ${Number(data.slice(8))}/${Number(data.slice(5, 7))}`
}

/** o que a busca enxerga de uma aula: "quinta 18h marina" estreita, não soma */
function textoDe(a: AulaParaRepor) {
  const h = Number(a.hora.slice(0, 2))
  return semAcento([
    DIAS[diaDaSemanaDe(a.data)], `${Number(a.data.slice(8))}/${Number(a.data.slice(5, 7))}`,
    a.hora, `${h}h`, a.servico, a.profissional, a.local,
  ].filter(Boolean).join(' '))
}

/**
 * Marcar uma aula para esta pessoa, começando por ela.
 *
 * É o caminho de balcão: "a Maria quer repor" ou "a Maria quer vir quinta". A
 * lista já vem só com horários que têm lugar, da modalidade dela, e um toque
 * marca. Quem tem falta em aberto marca como reposição da falta mais antiga
 * sem ninguém precisar lembrar; "Trocar" vira avulso para a exceção.
 *
 * Substitui a tela de Buscar vaga, que começava pelos filtros e só no fim
 * perguntava quem era a pessoa.
 */
export function MarcarAula({
  pessoaId, nome, servicos, servicoInicial, faltas, rotuloSessao, children, className,
  faltaFixa, aoMarcar,
}: {
  pessoaId: string
  nome: string
  /** as modalidades da conta, para trocar quando a pessoa faz mais de uma */
  servicos: Servico[]
  /** a modalidade da pessoa, quando dá para saber; `null` mostra todas */
  servicoInicial: string | null
  /** faltas em aberto, da mais antiga para a mais nova */
  faltas: FaltaParaRepor[]
  /** "Aula", "Sessão": o vocabulário da conta */
  rotuloSessao: string
  children: React.ReactNode
  className?: string
  /** aberto a partir de uma falta específica (aba Reposições): repõe esta */
  faltaFixa?: FaltaParaRepor
  /** depois de marcar, para quem chamou tirar o crédito da lista sem recarregar */
  aoMarcar?: () => void
}) {
  const [aberto, setAberto] = useState(false)
  const [servico, setServico] = useState<string | null>(servicoInicial)
  const [dias, setDias] = useState(14)
  const [aulas, setAulas] = useState<AulaParaRepor[] | null>(null)
  const [busca, setBusca] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [noLimite, setNoLimite] = useState<{ aula: AulaParaRepor; texto: string } | null>(null)
  const falta = faltaFixa ?? faltas[0] ?? null
  const [repor, setRepor] = useState(Boolean(falta))
  const [pendente, iniciar] = useTransition()
  const avisar = useAviso()

  function carregar(s: string | null, d: number) {
    setAulas(null)
    setErro(null)
    aulasParaRepor(s, d)
      .then(setAulas)
      .catch(() => { setAulas([]); setErro('Não foi possível carregar os horários. Tente de novo.') })
  }

  function abrir() {
    setAberto(true)
    setBusca('')
    setNoLimite(null)
    setRepor(Boolean(falta))
    setServico(servicoInicial)
    setDias(14)
    carregar(servicoInicial, 14)
  }

  function trocarServico(s: string | null) {
    setServico(s)
    carregar(s, dias)
  }

  function maisAdiante() {
    const d = dias + 14
    setDias(d)
    carregar(servico, d)
  }

  function marcar(a: AulaParaRepor, passarDoLimite = false) {
    setErro(null)
    setNoLimite(null)
    iniciar(async () => {
      const r = repor && falta
        ? await agendarReposicao(falta.id, a.sessaoId, pessoaId)
        : await encaixar({ sessaoId: a.sessaoId, pessoaId, origem: 'avulso', passarDoLimite })
      if (r.ok) {
        setAberto(false)
        aoMarcar?.()
        avisar({
          texto: `${nome.split(' ')[0]}: ${repor && falta ? 'reposição marcada' : 'marcado'} para ${diaPorExtenso(a.data).toLowerCase()}, ${a.hora}.`,
        })
        return
      }
      if (r.motivo === 'limite_da_semana') {
        setNoLimite({
          aula: a,
          texto: `O plano ${r.plano} dá direito a ${r.limite} ${r.limite === 1 ? 'aula' : 'aulas'} por semana, e esta semana já ${r.limite === 1 ? 'foi usada' : 'foram usadas'}.`,
        })
        return
      }
      if (r.motivo === 'dia_nao_permitido') {
        setNoLimite({ aula: a, texto: `O plano ${r.plano} não vale neste dia da semana.` })
        return
      }
      setErro(
        r.motivo === 'ja_participa'
          ? `${nome.split(' ')[0]} já está neste horário. Escolha outro.`
          : r.motivo === 'sessao_inexistente'
            ? 'Este horário não existe mais. Escolha outro.'
            : 'Este horário acabou de lotar. Escolha outro.',
      )
      carregar(servico, dias)
    })
  }

  const termos = semAcento(busca.trim()).split(/\s+/).filter(Boolean)
  const visiveis = (aulas ?? []).filter((a) => {
    const t = textoDe(a)
    return termos.every((x) => t.includes(x))
  })
  const porDia = new Map<string, AulaParaRepor[]>()
  for (const a of visiveis) porDia.set(a.data, [...(porDia.get(a.data) ?? []), a])

  return (
    <>
      <button type="button" onClick={abrir} className={className}>
        {children}
      </button>

      {aberto ? (
        <Modal
          aberto
          glifo="+"
          titulo={`Marcar ${rotuloSessao.toLowerCase()} para ${nome.split(' ')[0]}`}
          sub="Só horários com lugar. Um toque marca."
          largura="lista"
          secundario="Fechar"
          aoFechar={() => setAberto(false)}
        >
          {falta ? (
            <div className="flex items-center justify-between gap-3 rounded-media border border-linha-suave bg-superficie-suave px-3 py-2.5">
              <p className="text-[14.5px]">
                {repor ? (
                  <>Entra como <strong className="font-semibold">Reposição</strong>
                    <span className="text-tinta-media">, da falta de {falta.quando}</span></>
                ) : (
                  <>Entra como <strong className="font-semibold">Avulso</strong>
                    <span className="text-tinta-media">, só desta vez</span></>
                )}
              </p>
              {faltaFixa ? null : (
                <button
                  type="button"
                  onClick={() => setRepor(!repor)}
                  className="shrink-0 cursor-pointer text-[13.5px] font-medium text-marca hover:underline"
                >
                  {repor ? 'Marcar como avulso' : 'Usar a reposição'}
                </button>
              )}
            </div>
          ) : null}

          {servicos.length > 1 ? (
            <div role="group" aria-label="Modalidade" className="flex flex-wrap gap-1.5">
              <Chip ativo={servico === null} onClick={() => trocarServico(null)}>Todas</Chip>
              {servicos.map((s) => (
                <Chip key={s.id} ativo={servico === s.id} onClick={() => trocarServico(s.id)}>
                  {s.nome}
                </Chip>
              ))}
            </div>
          ) : null}

          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Exemplo: quinta 18h"
            aria-label="Procurar horário"
            className={entrada}
          />

          {noLimite ? (
            <div className="flex flex-col gap-2 rounded-media border border-atencao-linha bg-atencao-superficie p-3">
              <p className="text-[13.5px] leading-relaxed text-atencao">
                {noLimite.texto} Marcar mesmo assim fica registrado como decisão sua.
              </p>
              <div className="flex flex-wrap gap-2">
                <Botao miudo disabled={pendente} onClick={() => marcar(noLimite.aula, true)}>
                  Marcar mesmo assim
                </Botao>
                <Botao tom="fantasma" miudo onClick={() => setNoLimite(null)}>
                  Não marcar
                </Botao>
              </div>
            </div>
          ) : null}
          {erro ? <Nota tom="alerta">{erro}</Nota> : null}

          {aulas === null ? (
            <p className="py-3 text-[14.5px] text-tinta-media">Procurando horários com lugar…</p>
          ) : visiveis.length === 0 ? (
            <Nota tom="atencao">
              {aulas.length === 0
                ? `Nenhum horário com lugar nas próximas ${dias / 7} semanas.`
                : 'Nada com essa busca. Tente só o dia ou só a hora.'}
            </Nota>
          ) : (
            <div className="flex max-h-[46vh] flex-col gap-3 overflow-y-auto pb-1">
              {[...porDia.entries()].map(([data, itens]) => (
                <section key={data} className="flex flex-col gap-1.5">
                  <h3 className="text-[12px] font-semibold text-tinta-media">
                    {diaPorExtenso(data)}
                  </h3>
                  <ul className="flex flex-col gap-1.5">
                    {itens.map((a) => (
                      <li key={a.sessaoId}>
                        <button
                          type="button"
                          disabled={pendente}
                          onClick={() => marcar(a)}
                          className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-media border border-linha-suave bg-superficie px-3.5 py-2.5 text-left transition-colors duration-150 hover:border-marca hover:bg-superficie-tenue disabled:cursor-wait disabled:opacity-60"
                        >
                          <span className="w-12 shrink-0 text-[14.5px] font-medium">{a.hora}</span>
                          <span className="flex min-w-0 flex-1 flex-col leading-[1.35]">
                            <span className="truncate text-[14.5px] font-medium">{a.servico}</span>
                            <span className="truncate text-[12px] text-tinta-media">
                              {[a.profissional, a.local].filter(Boolean).join(' · ')}
                            </span>
                          </span>
                          <span className="shrink-0 text-[13.5px] text-tinta-media">
                            {a.livres === 1 ? '1 lugar' : `${a.livres} lugares`}
                          </span>
                          <span className="shrink-0 text-[13.5px] font-medium text-marca">Marcar</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}

          {aulas !== null && dias < 56 ? (
            <button
              type="button"
              onClick={maisAdiante}
              className="cursor-pointer self-start text-[13.5px] font-medium text-marca hover:underline"
            >
              Ver mais duas semanas
            </button>
          ) : null}
        </Modal>
      ) : null}
    </>
  )
}
