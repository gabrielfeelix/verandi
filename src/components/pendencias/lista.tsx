'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Etiqueta, Nota, entrada } from '@/components/ui/pecas'
import { paresDe, iniciaisDe } from '@/components/hoje/pecas'
import { Modal } from '@/components/ui/modal'
import { useAviso } from '@/components/ui/desfazer'
import { dispensarPendencia } from '@/server/pendencias/acoes'
import type { GrupoPendencia, Pendencia } from '@/server/pendencias/consultas'

/** A tinta de cada grupo, a mesma do cartão de Hoje. */
const TINTA_GRUPO: Record<string, string> = {
  chamada_nao_feita: 'bg-alerta-fundo text-alerta',
  reposicao_aberta: 'bg-atencao-fundo text-atencao',
  reserva_esperando: 'bg-info-fundo text-info',
  cadastro_incompleto: 'bg-neutro-fundo text-tinta-media',
}

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
  const [motivo, setMotivo] = useState(MOTIVOS[0])
  const [pendente, iniciar] = useTransition()
  const router = useRouter()
  const avisar = useAviso()

  const total = grupos.reduce((n, g) => n + g.itens.length, 0)

  if (total === 0) {
    return (
      <Nota tom="positivo">
        Nada pendente. Chamada em dia, nenhuma reposição esperando, e ninguém na
        fila — é assim que esta tela deve ficar na maior parte do tempo.
      </Nota>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {grupos.map((g) => (
        <section
          key={g.tipo}
          className="overflow-hidden rounded-cartao border border-linha bg-superficie"
        >
          {/* cada grupo tem a sua tinta: quatro contagens laranja lado a lado
              não hierarquizam nada */}
          <div
            className={`flex items-center gap-3 border-b border-linha-fina px-4.5 py-3.5 ${
              TINTA_GRUPO[g.tipo] ?? 'bg-superficie-suave text-tinta-media'
            }`}
          >
            <span className="flex size-8 items-center justify-center rounded-peca bg-superficie/70 text-[14px] font-semibold">
              {g.itens.length}
            </span>
            <span className="flex flex-col leading-[1.3]">
              <h2 className="text-[14px] font-medium">{g.titulo}</h2>
              <span className="text-[11.5px] opacity-75">{g.sub}</span>
            </span>
          </div>

          <ul>
            {g.itens.map((p) => {
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
                      className="flex size-8.5 shrink-0 items-center justify-center rounded-padrao bg-superficie-mais-suave font-mono text-[13px] text-tinta-media"
                    >
                      ◷
                    </span>
                  ) : (
                    <span
                      aria-hidden
                      className="flex size-8.5 shrink-0 items-center justify-center rounded-full text-[11.5px] font-semibold"
                      style={{ background: fundo, color: frente }}
                    >
                      {iniciaisDe(p.titulo)}
                    </span>
                  )}
                  <div className="flex min-w-40 flex-1 flex-col leading-[1.35]">
                    <span className="text-[14px] font-medium">{p.titulo}</span>
                    <span className="text-[12px] text-tinta-media">{p.detalhe}</span>
                  </div>
                  {i ? <Etiqueta tinta={i.tinta}>{i.texto}</Etiqueta> : null}
                  <span className="flex items-center gap-1.5">
                    <Link
                      href={p.href}
                      className="inline-flex min-h-10 items-center rounded-padrao bg-escuro px-3.5 text-[12.5px] font-medium text-tinta-clara hover:bg-escuro-hover"
                    >
                      Resolver
                    </Link>
                    <button
                      type="button"
                      onClick={() => setDispensando(p)}
                      className="min-h-10 rounded-padrao border border-linha-suave bg-superficie px-3 text-[12.5px] text-tinta-media hover:bg-superficie-suave hover:text-tinta"
                    >
                      Dispensar
                    </button>
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      <Modal
        aberto={dispensando !== null}
        glifo="×"
        titulo="Dispensar pendência"
        sub={dispensando ? `${dispensando.titulo} — sai da lista e não volta` : ''}
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
          <span className="text-[12.5px] font-medium">Motivo</span>
          <select
            className={entrada} value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            aria-label="Motivo"
          >
            {MOTIVOS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <Nota tom="neutro">
          Pendência que nunca zera vira ruído — por isso dispensar existe, com
          motivo e com o nome de quem dispensou.
        </Nota>
      </Modal>
    </div>
  )
}
