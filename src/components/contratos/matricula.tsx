'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Botao } from '@/components/ui/botao'
import { Modal, ModalFormulario } from '@/components/ui/modal'
import { Campo, Chip, Nota, entrada } from '@/components/ui/pecas'
import { CampoData } from '@/components/ui/campo-data'
import { CampoNumero } from '@/components/ui/campo-numero'
import { Escolha } from '@/components/ui/escolha'
import { useAviso } from '@/components/ui/desfazer'
import {
  criarContrato, trancarContrato, retomarContrato, encerrarContrato,
} from '@/server/contratos/acoes'
import { anteciparCobrancas } from '@/server/financeiro/acoes'
import { MAXIMO_MESES_ANTECIPADOS } from '@/core/financeiro/cobranca'
import type { ContratoLinha } from '@/server/contratos/consultas'
import type { PlanoLinha } from '@/server/planos/consultas'
import { comoCobra, emReais } from '@/core/planos/plano'
import { erroLegivel } from '@/core/erro-legivel'

/**
 * O contrato, e o que se faz com ele depois.
 *
 * O caminho principal é um envio só: escolher o plano, escolher os horários que
 * ele pede, dizer quando começa e pronto. Quem matricula está com a pessoa na
 * frente, e um fluxo de três telas garante contrato pela metade toda vez que
 * alguém for chamado no meio.
 *
 * O preço não é digitado: ele vem do plano, e a tela diz **qual** foi aplicado
 * e por quê. Digitar preço no contrato é como a tabela de preços do cliente
 * virou um documento com o código 104 em dois lugares.
 */

export type HorarioEscolhivel = {
  id: string
  diaSemana: number
  horaInicio: string
  codigo: string | null
  servicoId: string
  servico: string
  profissional: string | null
  local: string | null
  capacidade: number
  ocupadas: number
}

const DIAS = [
  'Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado',
]

const PAGAMENTOS = [
  { valor: '', rotulo: 'Não informado' },
  { valor: 'pix', rotulo: 'Pix' },
  { valor: 'dinheiro', rotulo: 'Dinheiro' },
  { valor: 'credito', rotulo: 'Cartão de crédito' },
  { valor: 'debito', rotulo: 'Cartão de débito' },
  { valor: 'transferencia', rotulo: 'Transferência' },
  { valor: 'boleto', rotulo: 'Boleto' },
]

export function NovaMatricula({
  pessoaId, pessoaNome, planos, horarios,
}: {
  pessoaId: string
  pessoaNome: string
  planos: PlanoLinha[]
  horarios: HorarioEscolhivel[]
}) {
  const [aberto, setAberto] = useState(false)
  const [planoId, setPlanoId] = useState<string | null>(null)
  const [escolhidas, setEscolhidas] = useState<string[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, comecar] = useTransition()
  const router = useRouter()
  const avisar = useAviso()

  const hoje = new Date().toLocaleDateString('en-CA')
  const ativos = useMemo(() => planos.filter((p) => p.ativo), [planos])
  const plano = ativos.find((p) => p.id === planoId) ?? null

  // os horários da modalidade do plano: oferecer os outros é oferecer o que
  // o contrato não pode ocupar
  const doPlano = useMemo(
    () => plano ? horarios.filter((t) => t.servicoId === plano.servicoId) : [],
    [plano, horarios])

  const pede = plano?.frequenciaSemanal ?? 0

  function fechar() {
    setAberto(false)
    setPlanoId(null)
    setEscolhidas([])
    setErro(null)
  }

  return (
    <>
      <Botao onClick={() => setAberto(true)}>Novo contrato</Botao>

      {aberto ? (
        <ModalFormulario
          aberto
          glifo="+"
          tom="positivo"
          titulo="Novo contrato"
          sub={pessoaNome}
          primario="Criar contrato"
          largura="lista"
          pendente={pendente || !planoId}
          aoFechar={fechar}
          aoEnviar={(f) => {
            if (!planoId) return
            setErro(null)
            comecar(async () => {
              const r = await criarContrato({
                pessoaId,
                planoId,
                serieIds: escolhidas,
                inicio: String(f.get('inicio') ?? hoje),
                diaVencimento: Number(f.get('diaVencimento') ?? 0) || null,
                formaPagamento: String(f.get('formaPagamento') ?? '') || null,
              })
              if (!r.ok) return setErro(r.erro)
              avisar({ texto: 'Contrato criado' })
              fechar()
              router.refresh()
            })
          }}
        >
          {ativos.length === 0 ? (
            <Nota tom="atencao">
              Nenhum plano em vigor no catálogo. Cadastre em Configuração,
              Planos e valores, e volte aqui.
            </Nota>
          ) : (
            <>
              <fieldset className="flex flex-col gap-2">
                <legend className="pb-1.5 text-[10.5px] font-semibold tracking-[.1em] text-tinta-fraca uppercase">
                  Qual plano
                </legend>
                <div className="flex flex-col gap-2">
                  {ativos.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { setPlanoId(p.id); setEscolhidas([]) }}
                      className={`flex flex-wrap items-center justify-between gap-2 rounded-media border px-3.5 py-2.5 text-left transition-colors duration-150 ${
                        planoId === p.id
                          ? 'border-marca bg-positivo-superficie'
                          : 'border-linha-suave bg-superficie hover:bg-superficie-mais-suave'
                      }`}
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="text-[13.5px] font-medium">{p.nome}</span>
                        <span className="text-[12px] text-tinta-media">
                          {p.servicoNome} · {comoCobra(p)}
                        </span>
                      </span>
                      <span className="font-mono text-[13px]">
                        {emReais(p.precoVinculadoCent === p.precoAvulsoCent
                          ? p.precoAvulsoCent
                          : p.precoAvulsoCent)}
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>

              {plano && pede > 0 ? (
                <fieldset className="flex flex-col gap-2">
                  <legend className="pb-1.5 text-[10.5px] font-semibold tracking-[.1em] text-tinta-fraca uppercase">
                    Quais horários
                  </legend>
                  <p className="pb-1 text-[12.5px] text-tinta-media">
                    {`o plano pede ${pede}, e ${escolhidas.length} ${escolhidas.length === 1 ? 'foi escolhido' : 'foram escolhidos'}`}
                  </p>
                  {doPlano.length === 0 ? (
                    <Nota tom="atencao">
                      A grade não tem horário fixo de {plano.servicoNome}. Monte
                      a grade antes de matricular.
                    </Nota>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {doPlano.map((t) => {
                        const cheia = t.ocupadas >= t.capacidade
                        const marcada = escolhidas.includes(t.id)
                        return (
                          <Chip
                            key={t.id}
                            ativo={marcada}
                            onClick={() => setEscolhidas((atual) =>
                              atual.includes(t.id)
                                ? atual.filter((x) => x !== t.id)
                                : [...atual, t.id])}
                          >
                            <span className="flex flex-col items-start">
                              <span>
                                {t.codigo ? `${t.codigo} · ` : ''}
                                {DIAS[t.diaSemana]} {t.horaInicio}
                              </span>
                              {/* a ocupação decide a escolha, e decidir sem ela
                                  é descobrir que a horário estava cheia no envio */}
                              <span className="text-[11px] opacity-70">
                                {t.ocupadas}/{t.capacidade}
                                {cheia ? ' · cheia' : ''}
                                {t.profissional ? ` · ${t.profissional}` : ''}
                              </span>
                            </span>
                          </Chip>
                        )
                      })}
                    </div>
                  )}
                </fieldset>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-3">
                <Campo rotulo="Começa em" htmlFor="mt-inicio" obrigatorio>
                  <CampoData id="mt-inicio" nome="inicio" valorInicial={hoje} limpavel={false} />
                </Campo>
                <Campo rotulo="Vence todo dia" htmlFor="mt-venc" dica="deixe vazio se não cobra por mês">
                  <CampoNumero id="mt-venc" nome="diaVencimento" min={1} max={31} valorInicial={5} />
                </Campo>
                <Campo rotulo="Forma de pagamento" htmlFor="mt-pag">
                  <Escolha
                    id="mt-pag" nome="formaPagamento" valorInicial=""
                    opcoes={PAGAMENTOS}
                  />
                </Campo>
              </div>

              {plano ? (
                <Nota tom="neutro">
                  {plano.precoVinculadoCent === plano.precoAvulsoCent
                    ? `Este plano tem preço único: ${emReais(plano.precoAvulsoCent)}.`
                    : `Se esta pessoa já tiver plano em vigor de outra modalidade, o sistema aplica ${emReais(plano.precoVinculadoCent)}; se não, ${emReais(plano.precoAvulsoCent)}. A ficha mostra qual foi.`}
                  {' '}A cobrança em si entra quando o financeiro estiver no ar.
                </Nota>
              ) : null}
            </>
          )}

          {erro ? <Nota tom="alerta">{erro}</Nota> : null}
        </ModalFormulario>
      ) : null}
    </>
  )
}

/**
 * Os contratos da pessoa, e o que se pode fazer com cada um.
 *
 * Trancar, retomar e encerrar moram aqui porque é aqui que a pergunta nasce:
 * "até quando vale?" e "ela está parada?" são a mesma conversa.
 */
export function ContratosDaFicha({
  contratos, pessoaNome,
}: {
  contratos: ContratoLinha[]
  pessoaNome: string
}) {
  const [modo, setModo] = useState<
    {
      tipo: 'trancar' | 'retomar' | 'encerrar' | 'antecipar'
      contrato: ContratoLinha
    } | null
  >(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, comecar] = useTransition()
  const router = useRouter()
  const avisar = useAviso()

  const hoje = new Date().toLocaleDateString('en-CA')

  function agir(fn: () => Promise<{ ok: true } | { ok: false; erro: string }>, texto: string) {
    setErro(null)
    comecar(async () => {
      try {
        const r = await fn()
        if (!r.ok) return setErro(r.erro)
        avisar({ texto })
        setModo(null)
        router.refresh()
      } catch (e) {
        setErro(erroLegivel(e))
      }
    })
  }

  if (contratos.length === 0) {
    return (
      <p className="text-[13px] text-tinta-media">
        Nenhum contrato ainda. É ela que diz qual plano {pessoaNome.split(' ')[0]}{' '}
        contratou, por quanto, e até quando.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2.5">
      {contratos.map((c) => (
        <div
          key={c.id}
          className={`flex flex-col gap-2 rounded-media border px-3.5 py-3 ${
            c.status === 'encerrado'
              ? 'border-linha-fina bg-[#FDFDFC] text-tinta-media'
              : 'border-linha-suave bg-superficie'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex min-w-0 flex-col">
              <span className="text-[13.5px] font-medium">
                {c.planoCodigo ? `${c.planoCodigo} · ` : ''}{c.planoNome}
              </span>
              <span className="text-[12px] text-tinta-media">
                {c.servicoNome}
                {c.fim ? ` · até ${c.fim.split('-').reverse().join('/')}` : ' · sem fim previsto'}
                {c.vagasVivas > 0 ? ` · ocupa ${c.vagasVivas}` : ''}
              </span>
            </span>
            <span className="flex items-center gap-2">
              <span className="font-mono text-[13px]">{emReais(c.precoAplicadoCent)}</span>
              <span
                className={`rounded-peca px-2.5 py-[5px] text-[11.5px] font-medium ${
                  c.status === 'ativo' ? 'bg-positivo-fundo text-positivo'
                    : c.status === 'pausado' ? 'bg-atencao-fundo text-atencao'
                    : 'bg-superficie-mais-suave text-tinta-media'
                }`}
              >
                {c.status === 'ativo' ? 'Em vigor'
                  : c.status === 'pausado' ? 'Trancado' : 'Encerrado'}
              </span>
            </span>
          </div>

          {/* por que aquele preço, sem precisar procurar na tabela */}
          {c.vinculoUsado ? (
            <p className="text-[11.5px] text-tinta-media">
              Preço de quem já é cliente de outra modalidade.
            </p>
          ) : null}

          {c.saldo ? (
            <p className={`text-[12px] ${c.saldo.acabou ? 'text-alerta' : 'text-tinta-media'}`}>
              {c.saldo.acabou
                ? `Pacote esgotado: ${c.saldo.usadas} sessões usadas.`
                : `Restam ${c.saldo.restantes} de ${c.saldo.usadas + c.saldo.restantes} sessões.`}
            </p>
          ) : null}

          {c.status !== 'encerrado' ? (
            <div className="flex flex-wrap gap-2">
              {c.status === 'ativo' ? (
                <BotaoMiudo onClick={() => setModo({ tipo: 'trancar', contrato: c })}>
                  Trancar
                </BotaoMiudo>
              ) : (
                <BotaoMiudo onClick={() => setModo({ tipo: 'retomar', contrato: c })}>
                  Retomar
                </BotaoMiudo>
              )}
              {/*
                * O sistema abre as cobranças até o mês que vem, e é isso que
                * mantém "a vencer" legível. Quem chega querendo pagar até
                * dezembro pede aqui, e as cobranças nascem na hora, cada uma
                * com a competência dela.
                */}
              {c.status === 'ativo' ? (
                <BotaoMiudo onClick={() => setModo({ tipo: 'antecipar', contrato: c })}>
                  Receber adiantado
                </BotaoMiudo>
              ) : null}
              <BotaoMiudo
                perigo
                onClick={() => setModo({ tipo: 'encerrar', contrato: c })}
              >
                Encerrar
              </BotaoMiudo>
            </div>
          ) : null}
        </div>
      ))}

      {modo ? (
        <ModalFormulario
          aberto
          glifo={
            modo.tipo === 'encerrar' ? '⨯'
              : modo.tipo === 'antecipar' ? 'R$' : '⏸'
          }
          tom={
            modo.tipo === 'encerrar' ? 'alerta'
              : modo.tipo === 'antecipar' ? 'positivo' : 'neutro'
          }
          titulo={
            modo.tipo === 'trancar' ? 'Trancar o contrato'
              : modo.tipo === 'retomar' ? 'Retomar o contrato'
              : modo.tipo === 'antecipar' ? 'Receber adiantado'
              : 'Encerrar o contrato'
          }
          sub={modo.contrato.planoNome}
          primario={
            modo.tipo === 'trancar' ? 'Trancar'
              : modo.tipo === 'retomar' ? 'Retomar'
              : modo.tipo === 'antecipar' ? 'Abrir os meses' : 'Encerrar'
          }
          pendente={pendente}
          aoFechar={() => { setModo(null); setErro(null) }}
          aoEnviar={(f) => {
            if (modo.tipo === 'antecipar') {
              const meses = Number(String(f.get('meses') ?? '').replace(/\D/g, ''))
              if (!meses) {
                return setErro('Escreva quantos meses quer abrir, a partir de um.')
              }
              return agir(
                () => anteciparCobrancas(modo.contrato.id, meses),
                'Meses abertos para receber',
              )
            }
            const data = String(f.get('data') ?? hoje)
            if (modo.tipo === 'trancar') {
              agir(() => trancarContrato(modo.contrato.id, data,
                String(f.get('motivo') ?? '') || null), 'Contrato trancado')
            } else if (modo.tipo === 'retomar') {
              agir(() => retomarContrato(modo.contrato.id, data), 'Contrato retomado')
            } else {
              agir(() => encerrarContrato(modo.contrato.id, data), 'Contrato encerrado')
            }
          }}
        >
          {modo.tipo === 'antecipar' ? (
            <>
              <Campo
                rotulo="Quantos meses abrir"
                htmlFor="ct-meses"
                dica={`a partir deste mês, até ${MAXIMO_MESES_ANTECIPADOS}`}
                obrigatorio
              >
                <input
                  id="ct-meses" name="meses" inputMode="numeric" pattern="[0-9]*"
                  defaultValue="3" maxLength={2} className={entrada}
                />
              </Campo>
              <Nota tom="neutro">
                As cobranças nascem uma por mês, com o vencimento que o contrato
                manda, e cada uma se recebe na lista do Financeiro. Cada mês
                pago fica com a competência dele: o fechamento de dezembro não
                vai achar que dezembro foi faturado hoje.
              </Nota>
            </>
          ) : (
          <Campo
            rotulo={
              modo.tipo === 'trancar' ? 'Para de vir em'
                : modo.tipo === 'retomar' ? 'Volta em' : 'Último dia'
            }
            htmlFor="ct-data"
            obrigatorio
          >
            <CampoData id="ct-data" nome="data" valorInicial={hoje} limpavel={false} />
          </Campo>
          )}

          {modo.tipo === 'trancar' ? (
            <>
              <Campo rotulo="Motivo" htmlFor="ct-motivo" dica="opcional, e ajuda a lembrar depois">
                <input
                  id="ct-motivo" name="motivo" maxLength={120}
                  placeholder="Ex.: viagem de três meses" className={entrada}
                />
              </Campo>
              <Nota tom="neutro">
                O lugar dela volta para o horário enquanto isso, e os dias parados
                são devolvidos no fim do contrato quando ela retomar.
              </Nota>
            </>
          ) : null}

          {modo.tipo === 'retomar' ? (
            <Nota tom="neutro">
              Os horários de antes voltam a ser dela, se ainda couberem. O fim do
              contrato anda para frente pelos dias que ficou parada.
            </Nota>
          ) : null}

          {modo.tipo === 'encerrar' ? (
            <Nota tom="alerta">
              Os horários deste contrato fecham nesta data. O que já aconteceu
              continua no histórico, e o contrato continua nomeando o que foi
              vendido.
            </Nota>
          ) : null}

          {erro ? <Nota tom="alerta">{erro}</Nota> : null}
        </ModalFormulario>
      ) : null}

      {erro && !modo ? <Nota tom="alerta">{erro}</Nota> : null}
    </div>
  )
}

function BotaoMiudo({
  children, perigo = false, ...resto
}: {
  children: React.ReactNode
  perigo?: boolean
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...resto}
      className={`min-h-9 cursor-pointer rounded-peca border px-3 text-[12.5px] disabled:opacity-50 ${
        perigo
          ? 'border-alerta-linha bg-superficie text-alerta hover:bg-alerta-superficie'
          : 'border-linha-suave bg-superficie text-tinta-media hover:bg-superficie-mais-suave'
      }`}
    >
      {children}
    </button>
  )
}
