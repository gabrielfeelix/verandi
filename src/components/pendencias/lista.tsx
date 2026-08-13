'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Botao } from '@/components/ui/botao'
import { Cartao, Etiqueta, Nota, entrada } from '@/components/ui/pecas'
import { Modal } from '@/components/ui/modal'
import { useAviso } from '@/components/ui/desfazer'
import { dispensarPendencia } from '@/server/pendencias/acoes'
import type { GrupoPendencia, Pendencia } from '@/server/pendencias/consultas'

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
        <Cartao
          key={g.tipo}
          titulo={g.titulo}
          acao={<Etiqueta tinta="neutro">{g.itens.length}</Etiqueta>}
        >
          <p className="mb-3 text-[12.5px] text-tinta-media">{g.sub}</p>
          <ul className="flex flex-col gap-2">
            {g.itens.map((p) => {
              const i = idade(p.diasEmAberto)
              return (
                <li key={`${p.tipo}-${p.referenciaId}`}
                  className="flex flex-wrap items-center gap-3 rounded-[--radius-padrao] border border-linha-suave p-3">
                  <div className="flex min-w-40 flex-col">
                    <span className="font-medium">{p.titulo}</span>
                    <span className="text-[12.5px] text-tinta-media">{p.detalhe}</span>
                  </div>
                  {i ? <Etiqueta tinta={i.tinta}>{i.texto}</Etiqueta> : null}
                  <span className="ml-auto flex items-center gap-2">
                    <Link
                      href={p.href}
                      className="inline-flex min-h-11 items-center rounded-[--radius-padrao] border border-linha bg-superficie px-4 text-[13px] font-medium"
                    >
                      Resolver
                    </Link>
                    <Botao tom="texto" miudo onClick={() => setDispensando(p)}>
                      Dispensar
                    </Botao>
                  </span>
                </li>
              )
            })}
          </ul>
        </Cartao>
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
