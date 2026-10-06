'use client'

import {
  createContext, useContext, useState, useTransition, type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { Modal, ModalFormulario } from '@/components/ui/modal'
import { Icone } from '@/components/ui/icones'
import { Campo, Nota } from '@/components/ui/pecas'
import { CampoData } from '@/components/ui/campo-data'
import { useAviso } from '@/components/ui/desfazer'
import { criarVaga, encerrarVaga } from '@/server/pessoas/acoes'
import { erroLegivel } from '@/core/erro-legivel'

type Props = {
  pessoaId: string
  vagas: Array<{
    id: string; rotulo: string; desde: string; ate: string | null
    dia: string; hora: string; servico: string; profissional: string | null
  }>
  series: Array<{
    id: string; rotulo: string; detalhe?: string; grupo?: string
    dia: number; hora: string; servico: string | null; profissional: string | null
    ocupadas: number; capacidade: number
  }>
  rotuloVaga: string
  rotuloSerie: string
  /** quem dá aula consulta os horários da pessoa, mas não cria nem encerra */
  podeEditar?: boolean
}

/*
 * "Agendar", no alto da ficha, e "Adicionar", dentro do cartão de matrículas,
 * são a mesma ação em dois lugares, e o lugar de baixo pode estar numa aba
 * fechada. Antes o botão de cima era uma âncora `#nova-matricula`: clicar não
 * abria nada, e em aba errada não rolava para lugar nenhum. Este contexto deixa
 * os dois abrirem o mesmo modal sem que a ficha (que é servidor) precise virar
 * cliente inteira.
 */
const Abrir = createContext<(() => void) | null>(null)

/** Muda de valor a cada clique em "Agendar": é o sinal para o modal abrir. */
const Pedido = createContext(0)

export function ProvedorDeMatricula({ children }: { children: ReactNode }) {
  const [pedido, setPedido] = useState(0)
  return (
    <Abrir.Provider value={() => setPedido((n) => n + 1)}>
      <Pedido.Provider value={pedido}>{children}</Pedido.Provider>
    </Abrir.Provider>
  )
}

export function BotaoAgendar({ children }: { children: ReactNode }) {
  const abrir = useContext(Abrir)
  return (
    <button
      type="button"
      onClick={() => abrir?.()}
      className="flex min-h-11 w-full cursor-pointer items-center justify-center rounded-media bg-escuro px-4 text-[14.5px] font-semibold text-tinta-clara transition-colors duration-150 hover:bg-escuro-hover"
    >
      {children}
    </button>
  )
}

export function Vagas({
  pessoaId, vagas, series, rotuloVaga, rotuloSerie, podeEditar = true,
}: Props) {
  const [pendente, iniciar] = useTransition()
  const [criando, setCriando] = useState(false)
  const [encerrando, setEncerrando] =
    useState<{ id: string; rotulo: string } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const pedido = useContext(Pedido)
  const [visto, setVisto] = useState(pedido)
  const router = useRouter()
  const avisar = useAviso()
  const hoje = new Date().toISOString().slice(0, 10)

  // o clique em "Agendar" lá em cima chega como um número novo
  if (pedido !== visto) {
    setVisto(pedido)
    if (!criando) setCriando(true)
  }

  const ativas = vagas.filter((v) => v.ate === null || v.ate >= hoje)
  const encerradas = vagas.filter((v) => v.ate !== null && v.ate < hoje)

  function fechar() {
    setCriando(false)
    setEncerrando(null)
    setErro(null)
  }

  return (
    <div className="flex flex-col gap-3">
      {ativas.length === 0 ? (
        <p className="text-[13.5px] text-tinta-media">
          Sem {rotuloSerie.toLowerCase()}. Quem só vem de vez em quando é
          normal: {rotuloVaga.toLowerCase()} existe para quem ocupa o mesmo
          horário toda semana.
        </p>
      ) : (
        /* cartão, não linha de tabela: o que se procura aqui é "que horário
           é esse", e dia e hora eram a última coisa a aparecer numa frase
           corrida separada por pontinhos */
        <ul className="grid gap-2 sm:grid-cols-2">
          {ativas.map((v) => (
            <li
              key={v.id}
              className="flex items-center gap-3 rounded-grande border border-linha-suave bg-superficie p-3"
            >
              <span className="flex size-12 shrink-0 flex-col items-center justify-center rounded-media bg-escuro leading-none text-tinta-clara">
                <span className="text-[12px] font-medium capitalize opacity-70">
                  {v.dia.slice(0, 3)}
                </span>
                <span className="pt-0.5 text-[14.5px] font-semibold">{v.hora}</span>
              </span>

              <span className="flex min-w-0 flex-1 flex-col gap-1 leading-tight">
                <span className="truncate text-[14.5px] font-medium">{v.servico}</span>
                <span className="flex flex-wrap items-center gap-1.5 text-[12px] text-tinta-media">
                  {v.profissional ? (
                    <span className="rounded-peca bg-superficie-suave px-2 py-0.5">
                      {v.profissional}
                    </span>
                  ) : null}
                  <span className="text-tinta-fraca">
                    desde {v.desde.slice(8)}/{v.desde.slice(5, 7)}/{v.desde.slice(2, 4)}
                  </span>
                </span>
              </span>

              {podeEditar ? (
              <button
                type="button"
                disabled={pendente}
                aria-label={`Encerrar ${v.rotulo}`}
                className="min-h-9 shrink-0 cursor-pointer rounded-peca px-3 text-[13.5px] text-tinta-media hover:bg-alerta-superficie hover:text-alerta"
                onClick={() => setEncerrando({ id: v.id, rotulo: v.rotulo })}
              >
                Encerrar
              </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {encerradas.length > 0 ? (
        <details>
          <summary className="cursor-pointer text-[13.5px] text-tinta-media">
            {encerradas.length} no histórico
          </summary>
          <ul className="mt-2 flex flex-col gap-1 text-[13.5px] text-tinta-media">
            {encerradas.map((v) => (
              <li key={v.id}>{v.rotulo}, de {v.desde} até {v.ate}</li>
            ))}
          </ul>
        </details>
      ) : null}

      {podeEditar ? (
      <>
      <button
        type="button"
        onClick={() => setCriando(true)}
        className="min-h-11 self-start rounded-padrao border border-linha bg-superficie px-3.5 text-[14.5px] font-medium hover:bg-superficie-mais-suave"
      >
        Criar {rotuloVaga.toLowerCase()}
      </button>
      <p className="text-[13.5px] text-tinta-fraca">
        Ocupa esse horário toda semana, por tempo indeterminado.
      </p>
      </>
      ) : null}

      {criando ? (
        <ModalFormulario
          aberto
          glifo="+"
          largura="lista"
          titulo={`Criar ${rotuloVaga.toLowerCase()}`}
          sub={`${rotuloVaga} ocupa o mesmo horário toda semana, a partir da data escolhida.`}
          primario="Criar"
          pendente={pendente}
          aoFechar={fechar}
          aoEnviar={(f) => {
            const serieIds = f.getAll('serie').map(String).filter(Boolean)
            // sem horário escolhido o formulário parava calado; agora o
            // navegador cobra o campo, e este `if` é só a rede de baixo
            if (!serieIds.length) return setErro('Escolha pelo menos um horário.')
            iniciar(async () => {
              setErro(null)
              try {
                // um por vez: se o segundo estiver cheio, o primeiro já entrou e
                // o erro diz qual faltou, em vez de desfazer o que deu certo
                for (const id of serieIds) {
                  await criarVaga(id, pessoaId, String(f.get('desde') ?? hoje))
                }
                avisar({ texto: serieIds.length > 1 ? `${serieIds.length} horários agendados` : 'Agendamento feito' })
                fechar()
                router.refresh()
              } catch (e) {
                setErro(erroLegivel(e))
              }
            })
          }}
        >
          {series.length === 0 ? (
            <Nota tom="atencao">
              Não há horário na grade fixa para ocupar. Crie o horário
              primeiro, em Grade fixa.
            </Nota>
          ) : (
            <>
              <EscolhaDeHorario
                series={series}
                aoTrocar={() => setErro(null)}
              />
              <Campo
                rotulo="A partir de quando?" htmlFor="vg-desde"
                dica="Vale desta data em diante. O que já passou não muda"
              >
                <CampoData id="vg-desde" nome="desde" valorInicial={hoje} limpavel={false} />
              </Campo>
            </>
          )}
          {erro ? <Nota tom="alerta">{erro}</Nota> : null}
        </ModalFormulario>
      ) : null}

      {encerrando ? (
        <Modal
          aberto
          perigo
          titulo={`Encerrar ${rotuloVaga.toLowerCase()}?`}
          sub={encerrando.rotulo}
          primario="Encerrar"
          pendente={pendente}
          aoFechar={fechar}
          aoConfirmar={() => iniciar(async () => {
            setErro(null)
            try {
              await encerrarVaga(encerrando.id, hoje)
              avisar({ texto: 'Agendamento encerrado' })
              fechar()
              router.refresh()
            } catch (e) {
              setErro(erroLegivel(e))
            }
          })}
        >
          <Nota>
            Vale a partir de hoje: o que já passou continua no histórico, e
            daqui para frente esse horário deixa de ser marcado sozinho.
          </Nota>
          {erro ? <Nota tom="alerta">{erro}</Nota> : null}
        </Modal>
      ) : null}
    </div>
  )
}

const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const DIAS_LONGOS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
// a semana de quem trabalha começa na segunda
const ORDEM_DOS_DIAS = [1, 2, 3, 4, 5, 6, 0]

/**
 * Primeiro o dia, depois a hora. A lista única com a grade inteira obrigava a
 * rolar por todos os horários da semana para achar a quinta-feira, e quem
 * abria parava no primeiro dia que aparecia.
 */
function EscolhaDeHorario({
  series, aoTrocar,
}: {
  series: Props['series']
  aoTrocar: () => void
}) {
  const dias = ORDEM_DOS_DIAS.filter((d) => series.some((s) => s.dia === d))
  const [dia, setDia] = useState(dias[0])
  const [escolhidas, setEscolhidas] = useState<string[]>([])
  const doDia = series.filter((s) => s.dia === dia)
  const variasModalidades = new Set(series.map((s) => s.servico)).size > 1
  const marcadas = series
    .filter((s) => escolhidas.includes(s.id))
    .sort((a, b) => ORDEM_DOS_DIAS.indexOf(a.dia) - ORDEM_DOS_DIAS.indexOf(b.dia) || a.hora.localeCompare(b.hora))

  return (
    <div className="flex flex-col gap-3">
      {escolhidas.map((id) => <input key={id} type="hidden" name="serie" value={id} />)}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-[12px] font-semibold text-tinta-fraca">Quais dias e horários?</p>
        <p className={`text-[13.5px] ${marcadas.length ? 'font-medium text-positivo' : 'text-tinta-media'}`} aria-live="polite">
          {marcadas.length === 0 ? 'Escolha um ou mais' : marcadas.length === 1 ? '1 escolhido' : `${marcadas.length} escolhidos`}
        </p>
      </div>

      <div role="tablist" aria-label="Dia da semana" className="-mx-2 flex gap-1.5 overflow-x-auto px-2 pt-2 pb-0.5">
        {dias.map((d) => {
          const ativo = d === dia
          const nele = marcadas.filter((m) => m.dia === d).length
          return (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={ativo}
              aria-label={DIAS_LONGOS[d]}
              onClick={() => setDia(d)}
              className={`relative flex min-h-10 min-w-[54px] shrink-0 cursor-pointer items-center justify-center rounded-padrao border px-3 text-[14.5px] transition-colors duration-150 ${
                ativo
                  ? 'border-escuro bg-escuro font-medium text-tinta-clara'
                  : 'border-linha bg-superficie text-tinta-media hover:bg-superficie-mais-suave'
              }`}
            >
              {DIAS_CURTOS[d]}
              {nele > 0 ? (
                <span aria-hidden className="absolute -top-1.5 -right-1.5 flex size-[18px] items-center justify-center rounded-full bg-marca text-[12px] font-semibold text-white ring-2 ring-superficie">
                  {nele}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      <div role="tabpanel" aria-label={DIAS_LONGOS[dia]} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {doDia.map((s) => {
          const cheia = s.ocupadas >= s.capacidade
          const esta = escolhidas.includes(s.id)
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={esta}
              aria-label={`${DIAS_LONGOS[s.dia]} ${s.hora}${s.servico ? `, ${s.servico}` : ''}${cheia ? ', cheia' : ''}`}
              disabled={cheia && !esta}
              onClick={() => {
                setEscolhidas((a) => esta ? a.filter((x) => x !== s.id) : [...a, s.id])
                aoTrocar()
              }}
              className={`flex flex-col items-start gap-0.5 rounded-media border px-3 py-2.5 text-left transition-colors duration-150 ${
                esta
                  ? 'border-marca bg-positivo-superficie'
                  : cheia
                    ? 'cursor-not-allowed border-linha-fina bg-superficie-suave text-tinta-fraca'
                    : 'cursor-pointer border-linha-suave bg-superficie hover:bg-superficie-mais-suave'
              }`}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="text-[16px] font-medium">{s.hora}</span>
                {esta ? (
                  <span className="flex size-5 items-center justify-center rounded-full bg-marca text-white">
                    <Icone nome="check" tamanho={12} />
                  </span>
                ) : null}
              </span>
              {variasModalidades && s.servico ? (
                <span className="w-full truncate text-[12px] text-tinta">{s.servico}</span>
              ) : null}
              {s.profissional ? (
                <span className="w-full truncate text-[12px] text-tinta-media">
                  {s.profissional.trim().split(/\s+/)[0]}
                </span>
              ) : null}
              <span className={`text-[12px] ${cheia ? 'text-alerta' : 'text-tinta-fraca'}`}>
                {cheia ? 'cheia' : `${s.capacidade - s.ocupadas} de ${s.capacidade} livres`}
              </span>
            </button>
          )
        })}
      </div>

      {/* o que já foi marcado nos outros dias, sem precisar voltar a cada aba */}
      {marcadas.length ? (
        <div className="flex flex-wrap gap-2">
          {marcadas.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setEscolhidas((a) => a.filter((x) => x !== m.id))}
              aria-label={`Tirar ${DIAS_LONGOS[m.dia]} ${m.hora}`}
              className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full border border-marca/40 bg-positivo-superficie px-3 text-[13.5px] hover:border-marca"
            >
              {DIAS_LONGOS[m.dia]} {m.hora}
              <Icone nome="fechar" tamanho={12} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
