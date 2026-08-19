'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cartao, Etiqueta, Nota, entrada } from '@/components/ui/pecas'
import { paresDe, iniciaisDe } from '@/components/hoje/pecas'
import { Modal } from '@/components/ui/modal'
import { useAviso } from '@/components/ui/desfazer'
import { dispensarPendencia } from '@/server/pendencias/acoes'
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
  if (dias < 7) return { texto: `há ${dias} dia(s)`, tinta: 'neutro' as const }
  if (dias < 30) return { texto: `há ${dias} dias`, tinta: 'atencao' as const }
  return { texto: `há ${dias} dias`, tinta: 'alerta' as const }
}

export function ListaPendencias({ grupos }: { grupos: GrupoPendencia[] }) {
  const [dispensando, setDispensando] = useState<Pendencia | null>(null)
  const [abertos, setAbertos] = useState<string[]>([])
  const [motivo, setMotivo] = useState(MOTIVOS[0])
  const [pendente, iniciar] = useTransition()
  const router = useRouter()
  const avisar = useAviso()

  const total = grupos.reduce((n, g) => n + g.itens.length, 0)

  if (total === 0) {
    return (
      <Nota tom="positivo">
        Nada pendente. Chamada em dia, nenhuma reposição esperando, e ninguém na
        fila, é assim que esta tela deve ficar na maior parte do tempo.
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
            <span className="font-titulo text-[30px] leading-none font-bold tracking-[-.03em]">
              {g.itens.length}
            </span>
            <span aria-hidden className="w-px self-stretch bg-current opacity-[.22]" />
            <span className="flex min-w-0 flex-col gap-[3px] leading-[1.25]">
              <h2 className="font-titulo text-[18px] font-semibold tracking-[-.01em]">
                {g.titulo}
              </h2>
              <span className="text-[12.5px] opacity-75">{g.sub}</span>
            </span>
          </div>

          <ul>
            {(abertos.includes(g.tipo) ? g.itens : g.itens.slice(0, MOSTRA)).map((p) => {
              const i = idade(p.diasEmAberto)
              const [fundo, frente] = paresDe(p.titulo)
              return (
                <li
                  key={`${p.tipo}-${p.referenciaId}`}
                  className="flex flex-wrap items-center gap-3.5 border-b border-linha-fina px-4.5 py-3 last:border-b-0 hover:bg-superficie-tenue"
                >
                  {/* chamada não feita é sobre um horário, não sobre alguém —
                      avatar com as iniciais de "Pilates solo" seria enfeite */}
                  {p.tipo === 'chamada_nao_feita' ? (
                    <span
                      aria-hidden
                      className="flex size-8.5 shrink-0 items-center justify-center rounded-padrao bg-superficie-mais-suave font-mono text-[14px] text-tinta-media"
                    >
                      ◷
                    </span>
                  ) : (
                    <span
                      aria-hidden
                      className="flex size-8.5 shrink-0 items-center justify-center rounded-full text-[12.5px] font-semibold"
                      style={{ background: fundo, color: frente }}
                    >
                      {iniciaisDe(p.titulo)}
                    </span>
                  )}
                  <div className="flex min-w-40 flex-1 flex-col leading-[1.35]">
                    <span className="text-[15px] font-medium">{p.titulo}</span>
                    <span className="text-[13px] text-tinta-media">{p.detalhe}</span>
                  </div>
                  {i ? <Etiqueta tinta={i.tinta}>{i.texto}</Etiqueta> : null}
                  <span className="flex items-center gap-1.5">
                    <Link
                      href={p.href}
                      className="inline-flex min-h-10 items-center rounded-padrao bg-escuro px-3.5 text-[13.5px] font-medium whitespace-nowrap text-tinta-clara hover:bg-escuro-hover"
                    >
                      {ACAO_GRUPO[p.tipo] ?? 'Resolver'}
                    </Link>
                    <button
                      type="button"
                      onClick={() => setDispensando(p)}
                      className="min-h-10 rounded-padrao border border-linha-suave bg-superficie px-3 text-[13.5px] text-tinta-media hover:bg-superficie-suave hover:text-tinta"
                    >
                      Dispensar
                    </button>
                  </span>
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
          Pendência que nunca zera vira ruído, por isso dispensar existe, com
          motivo e com o nome de quem dispensou.
        </Nota>
      </Modal>
    </div>
  )
}
