'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cartao, Etiqueta, Nota, entrada } from '@/components/ui/pecas'
import { paresDe, iniciaisDe } from '@/components/hoje/pecas'
import { Modal } from '@/components/ui/modal'
import { useAviso } from '@/components/ui/desfazer'
import { dispensarPendencia } from '@/server/pendencias/acoes'
import { marcarVolta, mudarVolta } from '@/server/licencas/acoes'
import { ModalVolta } from '@/components/licenca/modal-volta'
import type { GrupoPendencia, Pendencia } from '@/server/pendencias/consultas'
import { ACAO_GRUPO, TINTA_GRUPO } from './tintas'

const MOSTRA = 3

const MOTIVOS = [
  'Já resolvido fora do sistema',
  'Não se aplica',
  'A pessoa desistiu',
  'Erro de cadastro',
]

/** Crédito de seis meses atrás é uma conversa diferente do da semana passada. */
function idade(dias: number | null) {
  if (dias === null) return null
  if (dias === 0) return { texto: 'hoje', tinta: 'neutro' as const }
  if (dias < 7) return { texto: `há ${dias} ${dias === 1 ? 'dia' : 'dias'}`, tinta: 'neutro' as const }
  if (dias < 30) return { texto: `há ${dias} dias`, tinta: 'atencao' as const }
  return { texto: `há ${dias} dias`, tinta: 'alerta' as const }
}

export function ListaPendencias({ grupos: recebidos }: { grupos: GrupoPendencia[] }) {
  const [dispensando, setDispensando] = useState<Pendencia | null>(null)
  const [abertos, setAbertos] = useState<string[]>([])
  const [motivo, setMotivo] = useState(MOTIVOS[0])
  const [prorrogando, setProrrogando] = useState<Pendencia | null>(null)
  // "Voltou" tira a linha na hora; o servidor confirma por trás
  const [voltaram, setVoltaram] = useState<string[]>([])
  const [pendente, iniciar] = useTransition()
  const router = useRouter()
  const avisar = useAviso()

  const grupos = recebidos
    .map((g) => ({ ...g, itens: g.itens.filter((p) => !voltaram.includes(p.referenciaId)) }))
    .filter((g) => g.itens.length > 0)
  const total = grupos.reduce((n, g) => n + g.itens.length, 0)

  if (total === 0) {
    return (
      <Nota tom="positivo">
        Tudo em dia: chamadas feitas, nenhuma reposição esperando e ninguém na
        fila.
      </Nota>
    )
  }

  return (
    <div className="flex flex-col gap-3.5">
      {grupos.map((g) => (
        <section
          key={g.tipo}
          className={`overflow-hidden ${cartao}`}
        >
          {/* cada grupo tem a sua tinta: quatro contagens laranja lado a lado
              não hierarquizam nada */}
          <div
            className={`flex items-center gap-4 px-4.5 py-4 ${
              TINTA_GRUPO[g.tipo] ?? 'bg-superficie-suave text-tinta-media'
            }`}
          >
            {/* o número é o tamanho do problema: 30px, não 14 */}
            <span className="font-titulo text-[28px] leading-none font-bold tracking-[-.03em]">
              {g.itens.length}
            </span>
            <span aria-hidden className="w-px self-stretch bg-current opacity-[.22]" />
            <span className="flex min-w-0 flex-col gap-[3px] leading-[1.25]">
              <h2 className="font-titulo text-[18px] font-semibold tracking-[-.01em]">
                {g.titulo}
              </h2>
              <span className="text-[12px] opacity-75">{g.sub}</span>
            </span>
          </div>

          <ul>
            {(abertos.includes(g.tipo) ? g.itens : g.itens.slice(0, MOSTRA)).map((p) => {
              const i = p.etiqueta ?? idade(p.diasEmAberto)
              const [fundo, frente] = paresDe(p.titulo)
              return (
                <li
                  key={`${p.tipo}-${p.referenciaId}`}
                  className="flex flex-wrap items-center gap-3.5 border-b border-linha-fina px-4.5 py-3 last:border-b-0 hover:bg-superficie-tenue"
                >
                  {/* chamada não feita é sobre um horário, não sobre alguém,
                      avatar com as iniciais de "Pilates solo" seria enfeite */}
                  {p.tipo === 'chamada_nao_feita' ? (
                    <span
                      aria-hidden
                      className="flex size-8.5 shrink-0 items-center justify-center rounded-padrao bg-superficie-mais-suave text-[14.5px] text-tinta-media"
                    >
                      ◷
                    </span>
                  ) : (
                    <span
                      aria-hidden
                      className="flex size-8.5 shrink-0 items-center justify-center rounded-full text-[13.5px] leading-none font-semibold tracking-[-.02em]"
                      style={{ background: fundo, color: frente }}
                    >
                      {iniciaisDe(p.titulo)}
                    </span>
                  )}
                  <div className="flex min-w-40 flex-1 flex-col leading-[1.35]">
                    <span className="text-[14.5px] font-medium">{p.titulo}</span>
                    <span className="text-[13.5px] text-tinta-media">{p.detalhe}</span>
                  </div>
                  {i ? <Etiqueta tinta={i.tinta}>{i.texto}</Etiqueta> : null}
                  {p.licenca ? (
                  <span className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={pendente}
                      onClick={() => {
                        const alvo = p
                        setVoltaram((v) => [...v, alvo.referenciaId])
                        iniciar(async () => {
                          await marcarVolta(alvo.licenca!.pessoaId)
                          avisar({ texto: `${alvo.titulo}: licença encerrada` })
                          router.refresh()
                        })
                      }}
                      className="inline-flex min-h-10 items-center rounded-padrao border border-linha bg-superficie px-3.5 text-[13.5px] font-medium whitespace-nowrap text-tinta hover:border-tinta-media hover:bg-superficie-mais-suave"
                    >
                      Voltou
                    </button>
                    <button
                      type="button"
                      onClick={() => setProrrogando(p)}
                      className="min-h-10 rounded-padrao px-3 text-[13.5px] text-tinta-media hover:bg-superficie-suave hover:text-tinta"
                    >
                      {p.licenca.voltaPrevista ? 'Prorrogar' : 'Definir volta'}
                    </button>
                  </span>
                  ) : (
                  <span className="flex items-center gap-1.5">
                    <Link
                      href={p.href}
                      className="inline-flex min-h-10 items-center rounded-padrao border border-linha bg-superficie px-3.5 text-[13.5px] font-medium whitespace-nowrap text-tinta hover:border-tinta-media hover:bg-superficie-mais-suave"
                    >
                      {ACAO_GRUPO[p.tipo] ?? 'Resolver'}
                    </Link>
                    <button
                      type="button"
                      onClick={() => setDispensando(p)}
                      className="min-h-10 rounded-padrao px-3 text-[13.5px] text-tinta-media hover:bg-superficie-suave hover:text-tinta"
                    >
                      Dispensar
                    </button>
                  </span>
                  )}
                </li>
              )
            })}
          </ul>

          {g.itens.length > MOSTRA ? (
            <button
              type="button"
              onClick={() => setAbertos((a) =>
                a.includes(g.tipo) ? a.filter((x) => x !== g.tipo) : [...a, g.tipo])}
              className="w-full cursor-pointer bg-superficie-tenue px-4.5 py-3 text-left text-[13.5px] font-medium text-marca hover:bg-superficie-mais-suave"
            >
              {abertos.includes(g.tipo)
                ? 'Mostrar só as primeiras ↑'
                : `Ver as outras ${g.itens.length - MOSTRA} ↓`}
            </button>
          ) : null}
        </section>
      ))}

      {prorrogando?.licenca ? (
        <ModalVolta
          aberto
          nome={prorrogando.titulo}
          valorInicial={prorrogando.licenca.voltaPrevista ?? ''}
          pulavel={false}
          pendente={pendente}
          aoFechar={() => setProrrogando(null)}
          aoSalvar={(data) => {
            const alvo = prorrogando
            iniciar(async () => {
              await mudarVolta(alvo.licenca!.id, data)
              setProrrogando(null)
              avisar({ texto: data ? `${alvo.titulo}: nova data de volta` : `${alvo.titulo}: sem data de volta` })
              router.refresh()
            })
          }}
        />
      ) : null}

      <Modal
        aberto={dispensando !== null}
        glifo="×"
        titulo="Dispensar pendência"
        sub={dispensando ? `${dispensando.titulo}, sai da lista e não volta` : ''}
        primario="Dispensar"
        pendente={pendente}
        aoFechar={() => setDispensando(null)}
        aoConfirmar={() => {
          const alvo = dispensando
          if (!alvo) return
          iniciar(async () => {
            await dispensarPendencia({
              tipo: alvo.tipo, referenciaId: alvo.referenciaId, motivo,
            })
            setDispensando(null)
            avisar({ texto: 'Pendência dispensada · motivo registrado' })
            router.refresh()
          })
        }}
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-[13.5px] font-medium">Motivo</span>
          <select
            className={entrada} value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            aria-label="Motivo"
          >
            {MOTIVOS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <Nota tom="neutro">
          O item sai da lista e fica registrado com o motivo e o nome de quem
          dispensou.
        </Nota>
      </Modal>
    </div>
  )
}
