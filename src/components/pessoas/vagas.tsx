'use client'

import {
  createContext, useContext, useState, useTransition, type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { Modal, ModalFormulario } from '@/components/ui/modal'
import { Campo, Nota } from '@/components/ui/pecas'
import { Escolha } from '@/components/ui/escolha'
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
  series: Array<{ id: string; rotulo: string; detalhe?: string; grupo?: string }>
  rotuloVaga: string
  rotuloSerie: string
}

/*
 * "Agendar", no alto da ficha, e "Adicionar", dentro do cartão de matrículas,
 * são a mesma ação em dois lugares — e o lugar de baixo pode estar numa aba
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
      className="flex min-h-11 w-full items-center justify-center rounded-media bg-escuro px-4 text-[13.5px] font-semibold text-tinta-clara transition-colors duration-150 hover:bg-escuro-hover"
    >
      {children}
    </button>
  )
}

export function Vagas({ pessoaId, vagas, series, rotuloVaga, rotuloSerie }: Props) {
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
        <p className="text-[12.5px] text-tinta-media">
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
              <span className="flex size-12 shrink-0 flex-col items-center justify-center rounded-media bg-escuro font-mono leading-none text-tinta-clara">
                <span className="text-[10px] tracking-[.08em] uppercase opacity-70">
                  {v.dia.slice(0, 3)}
                </span>
                <span className="pt-0.5 text-[13px] font-semibold">{v.hora}</span>
              </span>

              <span className="flex min-w-0 flex-1 flex-col gap-1 leading-tight">
                <span className="truncate text-[13.5px] font-medium">{v.servico}</span>
                <span className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-tinta-media">
                  {v.profissional ? (
                    <span className="rounded-peca bg-superficie-suave px-2 py-0.5">
                      {v.profissional}
                    </span>
                  ) : null}
                  <span className="font-mono text-tinta-fraca">
                    desde {v.desde.slice(8)}/{v.desde.slice(5, 7)}/{v.desde.slice(2, 4)}
                  </span>
                </span>
              </span>

              <button
                type="button"
                disabled={pendente}
                aria-label={`Encerrar ${v.rotulo}`}
                className="min-h-9 shrink-0 cursor-pointer rounded-peca border border-alerta-linha-forte bg-alerta-superficie px-3 text-[12.5px] text-alerta hover:bg-alerta-fundo"
                onClick={() => setEncerrando({ id: v.id, rotulo: v.rotulo })}
              >
                Encerrar
              </button>
            </li>
          ))}
        </ul>
      )}

      {encerradas.length > 0 ? (
        <details>
          <summary className="cursor-pointer text-[12.5px] text-tinta-media">
            {encerradas.length} no histórico
          </summary>
          <ul className="mt-2 flex flex-col gap-1 text-[12.5px] text-tinta-media">
            {encerradas.map((v) => (
              <li key={v.id}>{v.rotulo}, de {v.desde} até {v.ate}</li>
            ))}
          </ul>
        </details>
      ) : null}

      <button
        type="button"
        onClick={() => setCriando(true)}
        className="min-h-11 self-start rounded-padrao border border-linha bg-superficie px-3.5 text-[13px] font-medium hover:bg-superficie-mais-suave"
      >
        Criar {rotuloVaga.toLowerCase()}
      </button>
      <p className="text-[12px] text-tinta-fraca">
        Ocupa esse horário toda semana, por tempo indeterminado.
      </p>

      {criando ? (
        <ModalFormulario
          aberto
          glifo="+"
          largura="lista"
          titulo="Novo agendamento"
          sub={`${rotuloVaga} ocupa o mesmo horário toda semana, a partir da data escolhida.`}
          primario="Agendar"
          pendente={pendente}
          aoFechar={fechar}
          aoEnviar={(f) => {
            const serieId = String(f.get('serie') ?? '')
            // sem horário escolhido o formulário parava calado; agora o
            // navegador cobra o campo, e este `if` é só a rede de baixo
            if (!serieId) return setErro('Escolha o horário.')
            iniciar(async () => {
              setErro(null)
              try {
                await criarVaga(serieId, pessoaId, String(f.get('desde') ?? hoje))
                avisar({ texto: 'Agendamento feito' })
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
              <Campo
                rotulo="Qual horário?" htmlFor="vg-serie"
                dica={`${series.length} na grade. A ocupação de cada um aparece na lista`}
              >
                <Escolha
                  id="vg-serie"
                  nome="serie"
                  autoFocus
                  opcoes={series.map((s) => ({
                    valor: s.id, rotulo: s.rotulo, detalhe: s.detalhe, grupo: s.grupo,
                  }))}
                  placeholder="Escolha o dia e a hora"
                  aoTrocar={() => setErro(null)}
                  invalido={erro !== null}
                />
              </Campo>
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
