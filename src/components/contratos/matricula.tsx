'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Botao } from '@/components/ui/botao'
import { Modal, ModalFormulario } from '@/components/ui/modal'
import { Campo, Nota, entrada } from '@/components/ui/pecas'
import { Icone } from '@/components/ui/icones'
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
 * Criar é em três etapas, uma decisão por vez: o plano, os horários que ele
 * pede e, por último, quando começa e como paga. A primeira versão era tudo
 * numa tela só, e com a grade de um estúdio de verdade (setenta horários) o
 * plano escolhido sumia lá em cima e a data de início ficava depois de uma
 * rolagem que ninguém sabia que existia.
 *
 * Nada é gravado antes do último passo: fechar no meio não deixa contrato pela
 * metade.
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
  /** a pessoa já está matriculada aqui sem contrato: o contrato novo adota */
  jaOcupa?: boolean
}

const DIAS = [
  'Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado',
]
const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
// a semana de quem trabalha começa na segunda
const ORDEM_DOS_DIAS = [1, 2, 3, 4, 5, 6, 0]

const PAGAMENTOS = [
  { valor: '', rotulo: 'Não informado' },
  { valor: 'pix', rotulo: 'Pix' },
  { valor: 'dinheiro', rotulo: 'Dinheiro' },
  { valor: 'credito', rotulo: 'Cartão de crédito' },
  { valor: 'debito', rotulo: 'Cartão de débito' },
  { valor: 'transferencia', rotulo: 'Transferência' },
  { valor: 'boleto', rotulo: 'Boleto' },
]

type Etapa = 'plano' | 'horarios' | 'pagamento'

const NOME_DA_ETAPA: Record<Etapa, string> = {
  plano: 'Plano',
  horarios: 'Horários',
  pagamento: 'Início e pagamento',
}

const rotuloDeSecao = 'text-[12px] font-semibold tracking-[.1em] text-tinta-fraca uppercase'

export function NovaMatricula({
  pessoaId, pessoaNome, planos, horarios,
}: {
  pessoaId: string
  pessoaNome: string
  planos: PlanoLinha[]
  horarios: HorarioEscolhivel[]
}) {
  const [aberto, setAberto] = useState(false)
  const [etapa, setEtapa] = useState<Etapa>('plano')
  const [planoId, setPlanoId] = useState<string | null>(null)
  const [escolhidas, setEscolhidas] = useState<string[]>([])
  const [dia, setDia] = useState<number | null>(null)
  // o que já foi escrito no último passo, para sobreviver a um "Voltar": o
  // formulário se limpa a cada envio, e cada "Continuar" é um envio
  const [rascunho, setRascunho] = useState({ inicio: '', vencimento: '5', pagamento: '' })
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, comecar] = useTransition()
  const router = useRouter()
  const avisar = useAviso()

  const hoje = new Date().toLocaleDateString('en-CA')
  const ativos = useMemo(() => planos.filter((p) => p.ativo), [planos])
  const plano = ativos.find((p) => p.id === planoId) ?? null

  // o catálogo de um estúdio passa de vinte planos: separados por modalidade,
  // na ordem em que aparecem, para "Pilates" não se misturar com "Fisioterapia"
  const porModalidade = useMemo(() => {
    const grupos = new Map<string, PlanoLinha[]>()
    for (const p of ativos) {
      const g = grupos.get(p.servicoNome) ?? []
      g.push(p)
      grupos.set(p.servicoNome, g)
    }
    return [...grupos.entries()]
  }, [ativos])

  // os horários da modalidade do plano: oferecer os outros é oferecer o que
  // o contrato não pode ocupar
  const doPlano = useMemo(
    () => plano
      ? horarios
        .filter((t) => t.servicoId === plano.servicoId)
        .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio)
          || (a.codigo ?? '').localeCompare(b.codigo ?? ''))
      : [],
    [plano, horarios])

  const diasComHorario = ORDEM_DOS_DIAS.filter((d) => doPlano.some((t) => t.diaSemana === d))
  const diaAberto = dia !== null && diasComHorario.includes(dia) ? dia : diasComHorario[0] ?? null
  const doDia = doPlano.filter((t) => t.diaSemana === diaAberto)

  // horário livre não escolhe lugar na grade: o limite vale na hora de marcar
  const pede = plano?.horarioLivre ? 0 : plano?.frequenciaSemanal ?? 0
  const etapas: Etapa[] = pede > 0 ? ['plano', 'horarios', 'pagamento'] : ['plano', 'pagamento']
  const indice = etapas.indexOf(etapa)
  // os horários em que ela já está, sem contrato, na modalidade do plano
  const minhas = doPlano.filter((t) => t.jaOcupa)
  const lotou = escolhidas.length >= pede
  const escolhidosEmOrdem = doPlano
    .filter((t) => escolhidas.includes(t.id))
    .sort((a, b) => ORDEM_DOS_DIAS.indexOf(a.diaSemana) - ORDEM_DOS_DIAS.indexOf(b.diaSemana)
      || a.horaInicio.localeCompare(b.horaInicio))

  function escolherPlano(id: string) {
    const p = ativos.find((x) => x.id === id)
    if (id !== planoId) {
      // quem já frequenta não precisa ser procurado na grade: os horários dela
      // vêm marcados, até o que o plano pede
      const dela = horarios.filter((t) => t.jaOcupa && t.servicoId === p?.servicoId)
      const marcadas = p?.horarioLivre ? [] : dela.slice(0, p?.frequenciaSemanal ?? 0)
      setEscolhidas(marcadas.map((t) => t.id))
      setDia(marcadas[0]?.diaSemana ?? null)
    }
    setPlanoId(id)
    setErro(null)
    // escolher o plano já é andar: o próximo passo é o que ele pede
    setEtapa(!p?.horarioLivre && (p?.frequenciaSemanal ?? 0) > 0 ? 'horarios' : 'pagamento')
  }

  function alternar(t: HorarioEscolhivel) {
    setEscolhidas((atual) => {
      if (atual.includes(t.id)) return atual.filter((x) => x !== t.id)
      // plano de uma vez por semana se comporta como escolha única: tocar em
      // outro troca, sem obrigar a desmarcar antes
      if (pede === 1) return [t.id]
      if (atual.length >= pede) return atual
      return [...atual, t.id]
    })
  }

  function fechar() {
    setAberto(false)
    setEtapa('plano')
    setPlanoId(null)
    setEscolhidas([])
    setDia(null)
    setRascunho({ inicio: '', vencimento: '5', pagamento: '' })
    setErro(null)
  }

  function sairPara(destino: Etapa) {
    if (etapa === 'pagamento') {
      const form = document.getElementById('mt-inicio')?.closest('form')
      if (form) {
        const f = new FormData(form)
        setRascunho({
          inicio: String(f.get('inicio') ?? ''),
          vencimento: String(f.get('diaVencimento') ?? ''),
          pagamento: String(f.get('formaPagamento') ?? ''),
        })
      }
    }
    setErro(null)
    setEtapa(destino)
  }

  function voltar() {
    sairPara(etapas[Math.max(0, indice - 1)])
  }

  const primario = etapa === 'pagamento' ? 'Criar contrato' : 'Continuar'
  const bloqueado = etapa === 'plano'
    ? !planoId
    : etapa === 'horarios'
      ? escolhidas.length !== pede
      : pendente

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
          primario={primario}
          secundario={indice > 0 ? 'Voltar' : 'Cancelar'}
          aoSecundario={indice > 0 ? voltar : undefined}
          largura="lista"
          pendente={bloqueado}
          aoFechar={fechar}
          topo={ativos.length > 0 ? (
            <Etapas
              etapas={etapas}
              atual={indice}
              irPara={(i) => sairPara(etapas[i])}
            />
          ) : null}
          aoEnviar={(f) => {
            if (!planoId) return
            if (etapa !== 'pagamento') {
              setEtapa(etapas[indice + 1])
              return
            }
            setErro(null)
            comecar(async () => {
              const r = await criarContrato({
                pessoaId,
                planoId,
                serieIds: pede > 0 ? escolhidas : [],
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
          ) : null}

          {etapa === 'plano' && ativos.length > 0 ? (
            <div className="flex flex-col gap-5">
              {porModalidade.map(([modalidade, lista]) => (
                <fieldset key={modalidade} className="flex flex-col gap-2">
                  <legend className={`pb-1.5 ${rotuloDeSecao}`}>{modalidade}</legend>
                  {lista.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => escolherPlano(p.id)}
                      className={`flex items-center justify-between gap-3 rounded-media border px-3.5 py-2.5 text-left transition-colors duration-150 ${
                        planoId === p.id
                          ? 'border-marca bg-positivo-superficie'
                          : 'border-linha-suave bg-superficie hover:bg-superficie-mais-suave'
                      }`}
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="text-[14.5px] font-medium">{p.nome}</span>
                        <span className="text-[13px] text-tinta-media">{comoCobra(p)}</span>
                      </span>
                      <span className="shrink-0 font-mono text-[14px]">
                        {emReais(p.precoAvulsoCent)}
                      </span>
                    </button>
                  ))}
                </fieldset>
              ))}
            </div>
          ) : null}

          {etapa === 'horarios' && plano ? (
            <>
              <PlanoEscolhido plano={plano} trocar={() => setEtapa('plano')} />

              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-[14.5px] font-medium">
                  {pede === 1
                    ? 'Escolha o horário da semana'
                    : `Escolha ${pede} horários da semana`}
                </p>
                <p
                  className={`text-[13.5px] ${lotou ? 'font-medium text-positivo' : 'text-tinta-media'}`}
                  aria-live="polite"
                >
                  {`${escolhidas.length} de ${pede} escolhido${pede === 1 ? '' : 's'}`}
                </p>
              </div>

              {minhas.length > pede ? (
                <Nota tom="atencao">
                  {`${pessoaNome} já está em ${minhas.length} horários de ${plano.servicoNome}, e o plano é de ${pede} por semana. Os que ficarem sem marcar continuam como estão, sem contrato.`}
                </Nota>
              ) : minhas.length > 0 ? (
                <Nota tom="neutro">
                  {minhas.length === 1
                    ? 'O horário em que a pessoa já está veio marcado e passa a fazer parte do contrato.'
                    : 'Os horários em que a pessoa já está vieram marcados e passam a fazer parte do contrato.'}
                </Nota>
              ) : null}

              {doPlano.length === 0 ? (
                <Nota tom="atencao">
                  A grade não tem horário fixo de {plano.servicoNome}. Monte
                  a grade antes de matricular.
                </Nota>
              ) : (
                <>
                  {/* um dia por vez: setenta horários numa parede só é como
                      a primeira versão desta tela ficou ilegível */}
                  <div role="tablist" aria-label="Dia da semana" className="flex gap-1.5 overflow-x-auto pb-0.5">
                    {diasComHorario.map((d) => {
                      const nele = escolhidas.filter((id) =>
                        doPlano.find((t) => t.id === id)?.diaSemana === d).length
                      const ativo = d === diaAberto
                      return (
                        <button
                          key={d}
                          type="button"
                          role="tab"
                          aria-selected={ativo}
                          aria-label={DIAS[d]}
                          onClick={() => setDia(d)}
                          className={`relative flex min-h-10 min-w-[54px] shrink-0 cursor-pointer items-center justify-center rounded-padrao border px-3 text-[14px] transition-colors duration-150 ${
                            ativo
                              ? 'border-escuro bg-escuro font-medium text-tinta-clara'
                              : 'border-linha bg-superficie text-tinta-media hover:bg-superficie-mais-suave'
                          }`}
                        >
                          {DIAS_CURTOS[d]}
                          {nele > 0 ? (
                            <span
                              aria-hidden
                              className={`absolute -top-1.5 -right-1.5 flex size-[18px] items-center justify-center rounded-full text-[11px] font-semibold ${
                                ativo ? 'bg-marca text-white ring-2 ring-superficie' : 'bg-marca text-white'
                              }`}
                            >
                              {nele}
                            </span>
                          ) : null}
                        </button>
                      )
                    })}
                  </div>

                  <div role="tabpanel" aria-label={diaAberto !== null ? DIAS[diaAberto] : undefined} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {doDia.map((t) => {
                      // o lugar dela já conta na ocupação: cheio, para ela, não está
                      const cheia = !t.jaOcupa && t.ocupadas >= t.capacidade
                      const marcada = escolhidas.includes(t.id)
                      const travada = !marcada && (cheia || (lotou && pede > 1))
                      return (
                        <button
                          key={t.id}
                          type="button"
                          aria-pressed={marcada}
                          aria-label={`${DIAS[t.diaSemana]} ${t.horaInicio}${t.codigo ? `, horário ${t.codigo}` : ''}${cheia ? ', cheia' : ''}`}
                          disabled={travada}
                          onClick={() => alternar(t)}
                          className={`relative flex flex-col items-start gap-0.5 rounded-media border px-3 py-2.5 text-left transition-colors duration-150 ${
                            marcada
                              ? 'border-marca bg-positivo-superficie'
                              : travada
                                ? 'cursor-not-allowed border-linha-fina bg-superficie-suave text-tinta-fraca'
                                : 'cursor-pointer border-linha-suave bg-superficie hover:bg-superficie-mais-suave'
                          }`}
                        >
                          <span className="flex w-full items-center justify-between gap-2">
                            <span className="font-mono text-[16px] font-medium">{t.horaInicio}</span>
                            {marcada ? (
                              <span className="flex size-5 items-center justify-center rounded-full bg-marca text-white">
                                <Icone nome="check" tamanho={12} />
                              </span>
                            ) : t.codigo ? (
                              <span className="font-mono text-[11.5px] text-tinta-fraca">{t.codigo}</span>
                            ) : null}
                          </span>
                          {t.profissional ? (
                            <span className="w-full truncate text-[12.5px] text-tinta-media">
                              {primeiroNome(t.profissional)}
                            </span>
                          ) : null}
                          {/* a ocupação decide a escolha, e decidir sem ela
                              é descobrir que o horário estava cheio no envio */}
                          <span className={`text-[12px] ${cheia ? 'text-alerta' : 'text-tinta-fraca'}`}>
                            {t.jaOcupa ? 'já está aqui' : cheia ? 'cheia' : `${t.capacidade - t.ocupadas} de ${t.capacidade} livres`}
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  {lotou && pede > 1 ? (
                    <p className="text-[13px] text-tinta-media">
                      Para trocar um horário, desmarque um dos escolhidos.
                    </p>
                  ) : null}
                </>
              )}
            </>
          ) : null}

          {etapa === 'pagamento' && plano ? (
            <>
              <PlanoEscolhido plano={plano} trocar={() => sairPara('plano')} />

              {pede > 0 ? (
                <div className="flex flex-col gap-2">
                  <p className={rotuloDeSecao}>Horários</p>
                  <div className="flex flex-wrap gap-2">
                    {escolhidosEmOrdem.map((t) => (
                      <span
                        key={t.id}
                        className="inline-flex min-h-8 items-center rounded-full border border-linha bg-superficie-suave px-3 text-[13.5px]"
                      >
                        {DIAS[t.diaSemana]} {t.horaInicio}
                        {t.profissional ? (
                          <span className="pl-1.5 text-tinta-media">· {primeiroNome(t.profissional)}</span>
                        ) : null}
                      </span>
                    ))}
                    <button
                      type="button"
                      onClick={() => sairPara('horarios')}
                      className="min-h-8 cursor-pointer rounded-full px-2 text-[13.5px] font-medium text-marca hover:underline"
                    >
                      Trocar
                    </button>
                  </div>
                </div>
              ) : null}

              {plano.horarioLivre && plano.frequenciaSemanal ? (
                <Nota tom="neutro">
                  {`Horário livre: ${pessoaNome.split(' ')[0]} marca até ${plano.frequenciaSemanal} ${plano.frequenciaSemanal === 1 ? 'aula' : 'aulas'} por semana, em qualquer horário de ${plano.servicoNome} que tenha lugar. Cada aula se marca na sessão, pelo Encaixe, ou pelo atendimento automático.`}
                </Nota>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-3">
                <Campo rotulo="Começa em" htmlFor="mt-inicio" obrigatorio>
                  <CampoData id="mt-inicio" nome="inicio" valorInicial={rascunho.inicio || hoje} limpavel={false} />
                </Campo>
                <Campo rotulo="Vence todo dia" htmlFor="mt-venc" dica="deixe vazio se não cobra por mês">
                  <CampoNumero id="mt-venc" nome="diaVencimento" min={1} max={31} valorInicial={rascunho.vencimento ? Number(rascunho.vencimento) : undefined} />
                </Campo>
                <Campo rotulo="Forma de pagamento" htmlFor="mt-pag">
                  <Escolha
                    id="mt-pag" nome="formaPagamento" valorInicial={rascunho.pagamento}
                    opcoes={PAGAMENTOS}
                  />
                </Campo>
              </div>

              <Nota tom="neutro">
                {plano.precoVinculadoCent === plano.precoAvulsoCent
                  ? `Este plano tem preço único: ${emReais(plano.precoAvulsoCent)}.`
                  : `Se esta pessoa já tiver plano em vigor de outra modalidade, o sistema aplica ${emReais(plano.precoVinculadoCent)}; se não, ${emReais(plano.precoAvulsoCent)}. A ficha mostra qual foi.`}
              </Nota>
            </>
          ) : null}

          {erro ? <Nota tom="alerta">{erro}</Nota> : null}
        </ModalFormulario>
      ) : null}
    </>
  )
}

function primeiroNome(nome: string) {
  return nome.trim().split(/\s+/)[0]
}

/**
 * Onde a pessoa está, e o caminho de volta: uma etapa já feita se toca para
 * reabrir; a que ainda não chegou não se toca, porque depende da anterior.
 */
function Etapas({
  etapas, atual, irPara,
}: {
  etapas: Etapa[]
  atual: number
  irPara: (i: number) => void
}) {
  return (
    <ol className="flex shrink-0 items-center gap-2 px-6 pb-4" aria-label="Etapas">
      {etapas.map((e, i) => {
        const feita = i < atual
        const agora = i === atual
        return (
          <li key={e} className={`flex min-w-0 items-center gap-2 ${i < etapas.length - 1 ? 'flex-1' : ''}`}>
            <button
              type="button"
              disabled={!feita}
              onClick={() => irPara(i)}
              aria-current={agora ? 'step' : undefined}
              className={`flex min-w-0 items-center gap-2 rounded-peca py-1 text-[13.5px] ${
                feita ? 'cursor-pointer hover:text-tinta' : 'cursor-default'
              } ${agora ? 'font-medium text-tinta' : 'text-tinta-media'}`}
            >
              <span
                aria-hidden
                className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${
                  agora
                    ? 'bg-escuro text-tinta-clara'
                    : feita
                      ? 'bg-marca text-white'
                      : 'border border-linha text-tinta-fraca'
                }`}
              >
                {feita ? <Icone nome="check" tamanho={12} /> : i + 1}
              </span>
              <span className={`truncate ${agora ? '' : 'max-sm:hidden'}`}>{NOME_DA_ETAPA[e]}</span>
            </button>
            {i < etapas.length - 1 ? (
              <span aria-hidden className={`h-px min-w-3 flex-1 ${feita ? 'bg-marca' : 'bg-linha'}`} />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

/** O plano no alto das etapas seguintes, para ninguém esquecer o que escolheu. */
function PlanoEscolhido({ plano, trocar }: { plano: PlanoLinha; trocar: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-media border border-linha-suave bg-superficie-suave px-3.5 py-2.5">
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[14.5px] font-medium">{plano.nome}</span>
        <span className="truncate text-[13px] text-tinta-media">
          {plano.servicoNome} · {emReais(plano.precoAvulsoCent)}
        </span>
      </span>
      <button
        type="button"
        onClick={trocar}
        className="min-h-8 shrink-0 cursor-pointer rounded-peca px-2 text-[13.5px] font-medium text-marca hover:underline"
      >
        Trocar plano
      </button>
    </div>
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
      <p className="text-[14px] text-tinta-media">
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
              <span className="text-[14.5px] font-medium">
                {c.planoCodigo ? `${c.planoCodigo} · ` : ''}{c.planoNome}
              </span>
              <span className="text-[13px] text-tinta-media">
                {c.servicoNome}
                {c.fim ? ` · até ${c.fim.split('-').reverse().join('/')}` : ' · sem fim previsto'}
                {c.vagasVivas > 0 ? ` · ocupa ${c.vagasVivas}` : ''}
              </span>
            </span>
            <span className="flex items-center gap-2">
              <span className="font-mono text-[14px]">{emReais(c.precoAplicadoCent)}</span>
              <span
                className={`rounded-peca px-2.5 py-[5px] text-[12.5px] font-medium ${
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
            <p className="text-[12.5px] text-tinta-media">
              Preço de quem já é cliente de outra modalidade.
            </p>
          ) : null}

          {c.saldo ? (
            <p className={`text-[13px] ${c.saldo.acabou ? 'text-alerta' : 'text-tinta-media'}`}>
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
              : modo.tipo === 'antecipar' ? 'R$' : undefined
          }
          icone={
            modo.tipo === 'trancar' ? 'cadeado'
              : modo.tipo === 'retomar' ? 'cadeado-aberto' : undefined
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
                  placeholder="Exemplo: viagem de três meses" className={entrada}
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
      className={`min-h-9 cursor-pointer rounded-peca border px-3 text-[13.5px] disabled:opacity-50 ${
        perigo
          ? 'border-alerta-linha bg-superficie text-alerta hover:bg-alerta-superficie'
          : 'border-linha-suave bg-superficie text-tinta-media hover:bg-superficie-mais-suave'
      }`}
    >
      {children}
    </button>
  )
}
