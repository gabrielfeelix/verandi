'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Botao } from '@/components/ui/botao'
import { cartao, Campo, Nota, entrada } from '@/components/ui/pecas'
import { Interruptor } from '@/components/ui/interruptor'
import { useAviso } from '@/components/ui/desfazer'
import {
  salvarFuncionamento, salvarDataFechada, removerDataFechada,
} from '@/server/config/acoes'
import type { DataFechada, DiaFuncionamento } from '@/server/config/consultas'

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

/*
 * A semana começa na segunda e termina no domingo.
 *
 * O banco guarda `dia_semana` no padrão do Postgres, com domingo em 0. A tela
 * não: quem confere horário de funcionamento lê a semana de trabalho, e o
 * domingo é a exceção que fica no fim — como na grade da semana, dois cliques
 * ao lado.
 */
const ORDEM = [1, 2, 3, 4, 5, 6, 0]

/**
 * Quando o negócio abre, e os dias em que não abre.
 *
 * Dia fechado aqui é o que faz a tela de agenda dizer "o estúdio não abre neste
 * dia" em vez de deixar o vazio parecer erro de carregamento.
 */
export function SecaoFuncionamento({
  dias, datas,
}: {
  dias: DiaFuncionamento[]
  datas: DataFechada[]
}) {
  const [estado, setEstado] = useState(dias)
  const [novaData, setNovaData] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const router = useRouter()
  const avisar = useAviso()

  function alterna(dia: number) {
    setEstado(estado.map((d) => d.diaSemana === dia
      ? (d.abre ? { ...d, abre: null, fecha: null } : { ...d, abre: '08:00', fecha: '18:00' })
      : d))
  }

  function muda(dia: number, campo: 'abre' | 'fecha', v: string) {
    setEstado(estado.map((d) => (d.diaSemana === dia ? { ...d, [campo]: v } : d)))
  }

  function comErro(fn: () => Promise<void>, texto: string, aoFim?: () => void) {
    iniciar(async () => {
      setErro(null)
      try {
        await fn()
        avisar({ texto })
        aoFim?.()
        router.refresh()
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'não deu para salvar')
      }
    })
  }

  const hoje = new Date().toLocaleDateString('en-CA')

  return (
    <section className={`${cartao} px-5 py-4.5`}>
      <h2 className="font-titulo text-[19px] font-semibold">
        Funcionamento e feriados
      </h2>
      <p className="pt-1.5 pb-4 text-[13px] text-tinta-media">
        Dias e horários em que o negócio abre; datas fechadas.
      </p>

      <div className="flex flex-col gap-[7px]">
        {ORDEM.map((dia) => estado.find((d) => d.diaSemana === dia))
          .filter((d) => d !== undefined)
          .map((d) => (
          <div
            key={d.diaSemana}
            className={`flex flex-wrap items-center gap-3.5 rounded-padrao border border-linha-fina px-3.5 py-2.5 ${
              d.abre ? 'bg-superficie' : 'bg-superficie-suave'
            }`}
          >
            <span className="w-20 text-[13.5px] font-medium">{DIAS[d.diaSemana]}</span>

            {d.abre ? (
              <span className="flex flex-1 flex-wrap items-center gap-2">
                <input
                  type="time" value={d.abre} aria-label={`${DIAS[d.diaSemana]} abre`}
                  onChange={(e) => muda(d.diaSemana, 'abre', e.target.value)}
                  className="min-h-10 rounded-peca border border-linha bg-superficie px-2.5 font-mono text-[13px]"
                />
                <span className="text-[12px] text-tinta-media">até</span>
                <input
                  type="time" value={d.fecha ?? ''} aria-label={`${DIAS[d.diaSemana]} fecha`}
                  onChange={(e) => muda(d.diaSemana, 'fecha', e.target.value)}
                  className="min-h-10 rounded-peca border border-linha bg-superficie px-2.5 font-mono text-[13px]"
                />
              </span>
            ) : (
              <span className="flex-1 font-mono text-[13px] text-tinta-fraca">
                não abre
              </span>
            )}

            <Interruptor
              ligado={d.abre !== null}
              rotulo={`Abrir ${DIAS[d.diaSemana].toLowerCase()}`}
              textoLigado="Aberto"
              textoDesligado="Fechado"
              aoMudar={() => alterna(d.diaSemana)}
            />
          </div>
        ))}
      </div>

      <p className="mt-3.5 rounded-media border border-atencao-fundo bg-[#FDF8EE] px-3.5 py-3 text-[12.5px] leading-relaxed text-atencao">
        Fechar um dia não apaga os horários fixos que já existem nele — eles
        continuam na grade, e a agenda daquele dia passa a dizer que o negócio
        não abre.
      </p>

      {erro ? <div className="pt-3"><Nota tom="alerta">{erro}</Nota></div> : null}

      <div className="pt-3.5">
        <Botao
          disabled={pendente}
          className="min-h-10 rounded-padrao"
          onClick={() => comErro(
            () => salvarFuncionamento(estado),
            'Funcionamento salvo',
          )}
        >
          Salvar funcionamento
        </Botao>
      </div>

      <div className="pt-4">
        <p className="pb-2.5 text-[10.5px] font-semibold tracking-[.1em] text-tinta-media uppercase">
          Datas fechadas
        </p>

        {novaData ? (
          <form
            className="mb-3 flex flex-col gap-3 rounded-grande border border-linha-fina bg-superficie-suave p-4"
            action={(f) => comErro(
              async () => {
                const r = await salvarDataFechada({
                  data: String(f.get('data') ?? ''),
                  tipo: String(f.get('tipo') ?? 'feriado') as 'feriado' | 'fechado',
                  descricao: String(f.get('descricao') ?? ''),
                  acao: String(f.get('acao') ?? 'cancelar_avisar') as
                    'cancelar_avisar' | 'so_marcar',
                })
                avisar({
                  texto: r.sessoesCanceladas > 0
                    ? `Data marcada · ${r.sessoesCanceladas} horário(s) cancelado(s)`
                    : 'Data marcada',
                })
              },
              'Data marcada',
              () => setNovaData(false),
            )}
          >
            <div className="flex flex-wrap items-start gap-3">
              <Campo rotulo="Data" htmlFor="dt-data">
                <input id="dt-data" name="data" type="date" required
                  defaultValue={hoje} className={entrada} />
              </Campo>
              <Campo rotulo="Nome" htmlFor="dt-desc" dica="aparece na agenda do dia">
                <input id="dt-desc" name="descricao" className={entrada}
                  placeholder="Natal" />
              </Campo>
              <Campo rotulo="Tipo" htmlFor="dt-tipo">
                <select id="dt-tipo" name="tipo" className={entrada}>
                  <option value="feriado">Feriado</option>
                  <option value="fechado">Fechado</option>
                </select>
              </Campo>
              <Campo
                rotulo="O que fazer com os horários do dia" htmlFor="dt-acao"
                dica="cancelar avisa quem tinha vaga fixa"
              >
                <select id="dt-acao" name="acao" className={entrada}>
                  <option value="cancelar_avisar">Cancelar e avisar</option>
                  <option value="so_marcar">Só marcar como fechado</option>
                </select>
              </Campo>
            </div>

            <Nota tom="atencao">
              Cancelar risca os horários daquele dia com o motivo, em vez de
              fazer eles sumirem. O que já aconteceu não muda.
            </Nota>

            <div className="flex gap-2">
              <Botao type="submit" miudo disabled={pendente}>Marcar data</Botao>
              <Botao type="button" tom="fantasma" miudo onClick={() => setNovaData(false)}>
                Cancelar
              </Botao>
            </div>
          </form>
        ) : null}

        <div className="flex flex-wrap gap-[7px]">
          {datas.map((d) => (
            <span
              key={d.id}
              className="inline-flex items-center gap-2 rounded-padrao border border-linha-suave bg-superficie-suave py-1.5 pr-2 pl-3 text-[13px]"
            >
              <span className="font-mono text-[12px] text-tinta-media">
                {d.data.slice(8)}/{d.data.slice(5, 7)}
              </span>
              {d.descricao ?? d.tipo}
              {d.acao === 'cancelar_avisar' ? (
                <span className="rounded-minima bg-alerta-fundo px-1.5 py-0.5 text-[10px] font-medium text-alerta">
                  cancela
                </span>
              ) : null}
              <button
                type="button"
                aria-label={`Remover ${d.descricao ?? d.data}`}
                disabled={pendente}
                onClick={() => comErro(() => removerDataFechada(d.id), 'Data removida')}
                className="flex size-7 items-center justify-center rounded-minima text-tinta-fraca hover:bg-alerta-fundo hover:text-alerta"
              >
                <span aria-hidden>×</span>
              </button>
            </span>
          ))}

          <button
            type="button"
            onClick={() => setNovaData(true)}
            className="min-h-10 rounded-padrao border border-dashed border-linha-tracejada px-3.5 text-[13px] whitespace-nowrap text-marca hover:bg-superficie-suave"
          >
            + Nova data fechada
          </button>
        </div>

        {datas.length === 0 && !novaData ? (
          <p className="pt-2.5 text-[12.5px] text-tinta-media">
            Nenhuma data marcada daqui para frente.
          </p>
        ) : null}
      </div>
    </section>
  )
}
