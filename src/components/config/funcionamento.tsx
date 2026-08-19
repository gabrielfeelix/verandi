'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ModalFormulario } from '@/components/ui/modal'
import { cartao, Campo, Chip, Nota, Rotulo, entrada } from '@/components/ui/pecas'
import { BotaoLinha } from './casca'
import { useAviso } from '@/components/ui/desfazer'
import {
  salvarFuncionamento, salvarDataFechada, removerDataFechada,
} from '@/server/config/acoes'
import type { DataFechada, DiaFuncionamento } from '@/server/config/consultas'
import { erroLegivel } from '@/core/erro-legivel'

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

/*
 * A semana começa na segunda e termina no domingo.
 *
 * O banco guarda `dia_semana` no padrão do Postgres, com domingo em 0. A tela
 * não: quem confere horário de funcionamento lê a semana de trabalho, e o
 * domingo é a exceção que fica no fim, como na grade da semana, dois cliques
 * ao lado.
 */
const ORDEM = [1, 2, 3, 4, 5, 6, 0]

/**
 * Quando o negócio abre, e os dias em que não abre.
 *
 * Dia fechado aqui é o que faz a tela de agenda dizer "o estúdio não abre neste
 * dia" em vez de deixar o vazio parecer erro de carregamento.
 *
 * **Um dia por vez, em modal.** É a mesma regra do resto da Configuração: item
 * de lista abre modal, tela que inteira é um formulário fica embutida. Sete
 * pares de campo de hora abertos ao mesmo tempo, com um "Salvar" só no pé,
 * fazem quem veio trocar o horário de terça salvar os sete sem saber.
 */
export function SecaoFuncionamento({
  dias, datas,
}: {
  dias: DiaFuncionamento[]
  datas: DataFechada[]
}) {
  const [estado, setEstado] = useState(dias)
  /** o dia em edição, `'data'` para o modal de data fechada, `null` fechado */
  const [modal, setModal] = useState<number | 'data' | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const router = useRouter()
  const avisar = useAviso()

  function comErro(fn: () => Promise<void>, texto: string, aoFim?: () => void) {
    iniciar(async () => {
      setErro(null)
      try {
        await fn()
        avisar({ texto })
        aoFim?.()
        router.refresh()
      } catch (e) {
        setErro(erroLegivel(e))
      }
    })
  }

  function fechar() {
    setModal(null)
    setErro(null)
  }

  /**
   * Salva a semana inteira com um dia trocado.
   *
   * `salvarFuncionamento` recebe os sete e é idempotente: apaga a linha do dia
   * fechado e faz upsert do aberto. Mandar só o dia editado exigiria uma segunda
   * ação no servidor que faria exatamente isto com um filtro a mais.
   */
  function salvarDia(dia: number, abre: string | null, fecha: string | null) {
    const proximo = estado.map((d) => (d.diaSemana === dia ? { ...d, abre, fecha } : d))
    comErro(
      async () => {
        await salvarFuncionamento(proximo)
        setEstado(proximo)
      },
      `Horário de ${DIAS[dia].toLowerCase()} salvo`,
      fechar,
    )
  }

  const hoje = new Date().toLocaleDateString('en-CA')
  const emEdicao = typeof modal === 'number'
    ? estado.find((d) => d.diaSemana === modal) ?? null
    : null

  return (
    <section className={`${cartao} px-5 py-4.5`}>
      <h2 className="font-titulo text-[19px] font-semibold">
        Funcionamento e feriados
      </h2>
      <p className="pt-1.5 pb-4 text-[14px] text-tinta-media">
        Dias e horários em que o negócio abre; datas fechadas.
      </p>

      <div className="flex flex-col gap-[7px]">
        {ORDEM.map((dia) => estado.find((d) => d.diaSemana === dia))
          .filter((d) => d !== undefined)
          .map((d) => (
            <div
              key={d.diaSemana}
              className={`flex flex-wrap items-center gap-3.5 rounded-media border border-linha-fina px-3.5 py-2.5 ${
                d.abre ? 'bg-superficie' : 'bg-superficie-suave'
              }`}
            >
              <span className="w-20 text-[14.5px] font-medium">{DIAS[d.diaSemana]}</span>

              <span
                className={`flex-1 font-mono text-[14px] ${
                  d.abre ? 'text-tinta-media' : 'text-tinta-fraca'
                }`}
              >
                {d.abre ? `${d.abre} até ${d.fecha}` : 'não abre'}
              </span>

              <span
                className={`rounded-peca px-2.5 py-[5px] text-[12.5px] font-medium ${
                  d.abre
                    ? 'bg-positivo-fundo text-positivo'
                    : 'bg-neutro-fundo text-tinta-media'
                }`}
              >
                {d.abre ? 'Aberto' : 'Fechado'}
              </span>

              <BotaoLinha
                tom="marca"
                aria-label={`Editar horário de ${DIAS[d.diaSemana].toLowerCase()}`}
                onClick={() => setModal(d.diaSemana)}
              >
                Editar
              </BotaoLinha>
            </div>
          ))}
      </div>

      {erro && modal === null ? (
        <div className="pt-3"><Nota tom="alerta">{erro}</Nota></div>
      ) : null}

      <div className="pt-4">
        <p className="pb-2.5 text-[12px] font-semibold tracking-[.1em] text-tinta-media uppercase">
          Datas fechadas
        </p>

        <div className="flex flex-wrap gap-[7px]">
          {datas.map((d) => (
            <span
              key={d.id}
              className="inline-flex items-center gap-2 rounded-padrao border border-linha-suave bg-superficie-suave py-1.5 pr-2 pl-3 text-[14px]"
            >
              <span className="font-mono text-[13px] text-tinta-media">
                {d.data.slice(8)}/{d.data.slice(5, 7)}
              </span>
              {d.descricao ?? d.tipo}
              {d.acao === 'cancelar_avisar' ? (
                <span className="rounded-minima bg-alerta-fundo px-1.5 py-0.5 text-[11.5px] font-medium text-alerta">
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
            onClick={() => setModal('data')}
            className="min-h-10 rounded-padrao border border-dashed border-linha-tracejada px-3.5 text-[14px] whitespace-nowrap text-marca hover:bg-superficie-suave"
          >
            + Nova data fechada
          </button>
        </div>

        {datas.length === 0 ? (
          <p className="pt-2.5 text-[13.5px] text-tinta-media">
            Nenhuma data marcada daqui para frente.
          </p>
        ) : null}
      </div>

      {emEdicao ? (
        <ModalDia
          dia={emEdicao}
          pendente={pendente}
          erro={erro}
          aoFechar={fechar}
          aoSalvar={salvarDia}
        />
      ) : null}

      {modal === 'data' ? (
        <ModalDataFechada
          hoje={hoje}
          pendente={pendente}
          erro={erro}
          aoFechar={fechar}
          aoSalvar={(e) => comErro(
            async () => {
              const r = await salvarDataFechada(e)
              avisar({
                texto: r.sessoesCanceladas > 0
                  ? `Data marcada, ${r.sessoesCanceladas} cancelada(s) e com reposição liberada`
                  : 'Data marcada',
              })
            },
            'Data marcada',
            fechar,
          )}
        />
      ) : null}
    </section>
  )
}

/**
 * O horário de um dia.
 *
 * O estado vem primeiro porque é ele que decide se os campos de hora fazem
 * sentido: fechado, os dois somem em vez de ficarem desabilitados pedindo para
 * serem preenchidos.
 */
function ModalDia({
  dia, pendente, erro, aoFechar, aoSalvar,
}: {
  dia: DiaFuncionamento
  pendente: boolean
  erro: string | null
  aoFechar: () => void
  aoSalvar: (dia: number, abre: string | null, fecha: string | null) => void
}) {
  const [aberto, setAberto] = useState(dia.abre !== null)
  const nome = DIAS[dia.diaSemana].toLowerCase()

  return (
    <ModalFormulario
      aberto
      glifo="◷"
      titulo={`Horário de ${nome}`}
      sub="Vale para a criação de horários novos e para o que a agenda mostra."
      primario="Salvar horário"
      pendente={pendente}
      aoFechar={aoFechar}
      aoEnviar={(f) => aoSalvar(
        dia.diaSemana,
        aberto ? String(f.get('abre') ?? '') : null,
        aberto ? String(f.get('fecha') ?? '') : null,
      )}
    >
      <div className="flex flex-col gap-2">
        <Rotulo>Estado</Rotulo>
        <div className="flex gap-2">
          <Chip ativo={aberto} onClick={() => setAberto(true)}>Aberto</Chip>
          <Chip ativo={!aberto} onClick={() => setAberto(false)}>Fechado</Chip>
        </div>
      </div>

      {aberto ? (
        <div className="flex flex-wrap items-start gap-3">
          <Campo rotulo="Abre" htmlFor="fn-abre" dica="Primeiro horário">
            <input
              id="fn-abre" name="abre" type="time" required
              defaultValue={dia.abre ?? '08:00'}
              className={`${entrada} w-36 font-mono`}
            />
          </Campo>
          <Campo rotulo="Fecha" htmlFor="fn-fecha" dica="Último horário">
            <input
              id="fn-fecha" name="fecha" type="time" required
              defaultValue={dia.fecha ?? '18:00'}
              className={`${entrada} w-36 font-mono`}
            />
          </Campo>
        </div>
      ) : null}

      <Nota tom="atencao">
        Fechar um dia não apaga o que já está na grade. O que existe continua
        lá, e a agenda daquele dia passa a dizer que o negócio não abre.
      </Nota>

      {erro ? <Nota tom="alerta">{erro}</Nota> : null}
    </ModalFormulario>
  )
}

/**
 * Feriado, recesso ou manutenção.
 *
 * A escolha do que fazer com o dia é regra de negócio, não forma: cancelar
 * risca o que estava marcado **e** libera reposição para quem tinha vaga fixa,
 * porque quem perdeu a aula foi o negócio que fechou, não a pessoa que faltou.
 * "Só marcar" existe para o feriado que o estúdio decide trabalhar.
 */
function ModalDataFechada({
  hoje, pendente, erro, aoFechar, aoSalvar,
}: {
  hoje: string
  pendente: boolean
  erro: string | null
  aoFechar: () => void
  aoSalvar: (e: {
    data: string
    tipo: 'feriado' | 'fechado'
    descricao: string
    acao: 'cancelar_avisar' | 'so_marcar'
  }) => void
}) {
  const [acao, setAcao] = useState<'cancelar_avisar' | 'so_marcar'>('cancelar_avisar')

  return (
    <ModalFormulario
      aberto
      glifo="+"
      titulo="Nova data fechada"
      sub="Feriado, recesso ou manutenção."
      primario="Adicionar data"
      pendente={pendente}
      aoFechar={aoFechar}
      aoEnviar={(f) => aoSalvar({
        data: String(f.get('data') ?? ''),
        tipo: String(f.get('tipo') ?? 'feriado') as 'feriado' | 'fechado',
        descricao: String(f.get('descricao') ?? ''),
        acao,
      })}
    >
      <div className="flex flex-wrap items-start gap-3">
        <Campo rotulo="Data" htmlFor="dt-data">
          <input id="dt-data" name="data" type="date" required
            defaultValue={hoje} className={entrada} />
        </Campo>
        <Campo rotulo="Nome" htmlFor="dt-desc" dica="Aparece na agenda do dia">
          <input id="dt-desc" name="descricao" className={entrada}
            placeholder="Natal" />
        </Campo>
        <Campo rotulo="Tipo" htmlFor="dt-tipo">
          <select id="dt-tipo" name="tipo" className={entrada}>
            <option value="feriado">Feriado</option>
            <option value="fechado">Fechado</option>
          </select>
        </Campo>
      </div>

      {/* o rótulo não nomeia a sessão de propósito: "o que fazer com as
          sessões" vira "com as atendimentos" numa conta de clínica, e aqui o
          artigo é inevitável. A frase muda, como manda a régua do vocabulário. */}
      <div className="flex flex-col gap-2">
        <Rotulo>O que fazer com o que já está marcado no dia</Rotulo>
        <div className="flex flex-wrap gap-2">
          <Chip
            ativo={acao === 'cancelar_avisar'}
            onClick={() => setAcao('cancelar_avisar')}
          >
            Cancelar e liberar reposição
          </Chip>
          <Chip ativo={acao === 'so_marcar'} onClick={() => setAcao('so_marcar')}>
            Só marcar como fechado
          </Chip>
        </div>
      </div>

      {acao === 'cancelar_avisar' ? (
        <Nota tom="positivo">
          Cancelar risca o que estava marcado naquele dia, com o motivo, em vez
          de fazer sumir, e quem tinha vaga fixa entra em Pendências com
          reposição em aberto. O aviso continua sendo seu: o sistema ainda não
          manda mensagem sozinho.
        </Nota>
      ) : (
        <Nota tom="atencao">
          Só marcar deixa o dia na agenda como fechado e não mexe no que estava
          marcado. É o feriado em que o negócio decide trabalhar.
        </Nota>
      )}

      {erro ? <Nota tom="alerta">{erro}</Nota> : null}
    </ModalFormulario>
  )
}
