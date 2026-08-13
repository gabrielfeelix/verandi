'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Botao } from '@/components/ui/botao'
import { Campo, Cartao, Chip, Etiqueta, Nota, entrada } from '@/components/ui/pecas'
import { useAviso } from '@/components/ui/desfazer'
import {
  salvarFuncionamento, salvarDataFechada, removerDataFechada,
} from '@/server/config/acoes'
import type { DataFechada, DiaFuncionamento } from '@/server/config/consultas'

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

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
    <div className="flex flex-col gap-4">
      <Cartao titulo="Funcionamento">
        <div className="flex flex-col gap-4">
          <p className="text-[12.5px] text-tinta-media">
            Os dias e horários em que o negócio abre. Serve para sugerir faixa ao
            montar a grade e para o dia fechado explicar que não é falha.
          </p>

          <ul className="flex flex-col gap-2">
            {estado.map((d) => (
              <li key={d.diaSemana} className="flex flex-wrap items-center gap-3">
                <span className="w-24 text-[13px]">{DIAS[d.diaSemana]}</span>
                <Chip ativo={!!d.abre} onClick={() => alterna(d.diaSemana)}>
                  {d.abre ? 'Aberto' : 'Fechado'}
                </Chip>
                {d.abre ? (
                  <>
                    <input
                      type="time" value={d.abre} aria-label={`${DIAS[d.diaSemana]} abre`}
                      onChange={(e) => muda(d.diaSemana, 'abre', e.target.value)}
                      className={`${entrada} w-32`}
                    />
                    <span className="text-tinta-media">até</span>
                    <input
                      type="time" value={d.fecha ?? ''} aria-label={`${DIAS[d.diaSemana]} fecha`}
                      onChange={(e) => muda(d.diaSemana, 'fecha', e.target.value)}
                      className={`${entrada} w-32`}
                    />
                  </>
                ) : null}
              </li>
            ))}
          </ul>

          <Nota tom="atencao">
            Fechar um dia não apaga os horários fixos que já existem nele — eles
            continuam na grade, e a agenda daquele dia passa a dizer que o
            negócio não abre.
          </Nota>

          {erro ? <Nota tom="alerta">{erro}</Nota> : null}

          <div>
            <Botao
              disabled={pendente}
              onClick={() => comErro(
                () => salvarFuncionamento(estado),
                'Funcionamento salvo',
              )}
            >
              Salvar funcionamento
            </Botao>
          </div>
        </div>
      </Cartao>

      <Cartao
        titulo="Datas fechadas"
        acao={<Botao miudo onClick={() => setNovaData(true)}>Nova data</Botao>}
      >
        <div className="flex flex-col gap-3">
          <p className="text-[12.5px] text-tinta-media">
            Feriado, recesso ou manutenção.
          </p>

          {novaData ? (
            <form
              className="flex flex-col gap-3 rounded-[--radius-padrao] bg-superficie-suave p-3"
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
                <Botao type="button" tom="texto" miudo onClick={() => setNovaData(false)}>
                  Cancelar
                </Botao>
              </div>
            </form>
          ) : null}

          {datas.length === 0 && !novaData ? (
            <Nota tom="neutro">
              Nenhuma data marcada daqui para frente.
            </Nota>
          ) : null}

          <ul className="flex flex-col gap-2">
            {datas.map((d) => (
              <li key={d.id}
                className="flex flex-wrap items-center gap-3 rounded-[--radius-padrao] border border-linha-suave p-3">
                <span className="font-mono text-[13px]">{d.data}</span>
                <span>{d.descricao ?? d.tipo}</span>
                <Etiqueta tinta={d.tipo === 'feriado' ? 'info' : 'neutro'}>{d.tipo}</Etiqueta>
                {d.acao === 'cancelar_avisar' ? (
                  <Etiqueta tinta="alerta">cancela os horários</Etiqueta>
                ) : null}
                <Botao
                  tom="texto" miudo className="ml-auto" disabled={pendente}
                  onClick={() => comErro(() => removerDataFechada(d.id), 'Data removida')}
                >
                  Remover
                </Botao>
              </li>
            ))}
          </ul>
        </div>
      </Cartao>
    </div>
  )
}
