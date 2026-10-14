'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Botao } from '@/components/ui/botao'
import { Icone } from '@/components/ui/icones'
import { ModalFormulario } from '@/components/ui/modal'
import { Avatar, Campo, Nota, entrada } from '@/components/ui/pecas'
import { Escolha } from '@/components/ui/escolha'
import { CampoData } from '@/components/ui/campo-data'
import { CampoDinheiro, formatarReais } from '@/components/ui/campo-dinheiro'
import { CampoNumero } from '@/components/ui/campo-numero'
import { buscarCandidatos } from '@/server/agenda/acoes'
import { emitirReciboAvulso, pagadorDoRecibo } from '@/server/recibo/acoes'
import { emCentavos, emReais, type Recorrencia } from '@/core/planos/plano'
import { documentoFormatado } from '@/core/recibo/recibo'
import { fimDoContrato } from '@/core/contratos/contrato'
import type { Forma } from '@/core/financeiro/fechamento'

export type PlanoDoRecibo = {
  id: string
  nome: string
  precoCent: number
  parcelas: number
  recorrencia: Recorrencia
  validadeMeses: number | null
}

const FORMAS: Array<{ valor: Forma; rotulo: string }> = [
  { valor: 'credito', rotulo: 'Cartão de crédito' },
  { valor: 'debito', rotulo: 'Cartão de débito' },
  { valor: 'pix', rotulo: 'Pix' },
  { valor: 'dinheiro', rotulo: 'Dinheiro' },
  { valor: 'transferencia', rotulo: 'Transferência' },
  { valor: 'boleto', rotulo: 'Boleto' },
]

const reais = (cent: number) => formatarReais(String(cent))

/**
 * O recibo que começa pelo aluno e pelo plano.
 *
 * Pedido do Daniel (MGM, 13/10/2026): buscar o aluno, que já traz a
 * matrícula; o plano, que já traz valor e parcelas; o valor editável quando há
 * desconto; e a validade do plano, editável. O dinheiro não passa por aqui:
 * quem lança no caixa é o contrato, e o aviso no fim do formulário diz isso.
 */
type Aluno = { id: string; nome: string; detalhe: string }

export function NovoRecibo({
  planos, hoje, alunoInicial = null,
}: {
  planos: PlanoDoRecibo[]
  hoje: string
  /** quem abre o recibo já de dentro da ficha chega com o aluno escolhido */
  alunoInicial?: (Aluno & { cpf: string | null; matricula: string | null }) | null
}) {
  const [aberto, setAberto] = useState(false)
  const [aluno, setAluno] = useState<Aluno | null>(alunoInicial)
  const [cpf, setCpf] = useState(documentoFormatado(alunoInicial?.cpf ?? null) ?? '')
  const [matricula, setMatricula] = useState(alunoInicial?.matricula ?? '')
  const [termo, setTermo] = useState('')
  const [achados, setAchados] = useState<Array<{ id: string; nome: string; detalhe: string }>>([])
  const [planoId, setPlanoId] = useState('')
  const [valorPlano, setValorPlano] = useState('')
  const [recebido, setRecebido] = useState('')
  const [de, setDe] = useState(hoje)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, comecar] = useTransition()
  const router = useRouter()

  useEffect(() => {
    if (aluno || termo.trim().length < 2) return
    const t = setTimeout(() => {
      buscarCandidatos(termo).then(setAchados).catch(() => setAchados([]))
    }, 250)
    return () => clearTimeout(t)
  }, [termo, aluno])

  const plano = planos.find((p) => p.id === planoId) ?? null
  const ate = plano ? fimDoContrato(de, plano) : null
  const planoCent = emCentavos(valorPlano) ?? 0
  const recebidoCent = emCentavos(recebido) ?? 0
  const descontoCent = planoCent - recebidoCent

  function escolherPlano(id: string) {
    const p = planos.find((x) => x.id === id)
    setPlanoId(id)
    if (!p) return
    setValorPlano(reais(p.precoCent))
    setRecebido(reais(p.precoCent))
  }

  // o CPF e a matrícula que vão para o papel aparecem assim que o aluno é
  // escolhido, para corrigir ali, e não depois de emitido
  function escolherAluno(x: Aluno) {
    setAluno(x); setAchados([])
    setCpf(''); setMatricula('')
    pagadorDoRecibo(x.id)
      .then((p) => { setCpf(documentoFormatado(p.cpf) ?? ''); setMatricula(p.matricula ?? '') })
      .catch(() => {})
  }

  function fechar() {
    setAberto(false)
    setAluno(alunoInicial); setTermo(''); setAchados([])
    setCpf(documentoFormatado(alunoInicial?.cpf ?? null) ?? ''); setMatricula(alunoInicial?.matricula ?? '')
    setPlanoId(''); setValorPlano(''); setRecebido(''); setDe(hoje)
    setErro(null)
  }

  return (
    <>
      <Botao onClick={() => setAberto(true)}>
        <Icone nome="mais" tamanho={16} />
        Novo recibo
      </Botao>

      {aberto ? (
        <ModalFormulario
          aberto
          glifo="R$"
          tom="positivo"
          titulo="Novo recibo"
          sub="Comprovante de pagamento de plano"
          primario="Emitir recibo"
          largura="lista"
          pendente={pendente || !aluno || !plano}
          aoFechar={fechar}
          aoEnviar={(f) => {
            if (!aluno || !plano) return
            setErro(null)
            comecar(async () => {
              const r = await emitirReciboAvulso({
                pessoaId: aluno.id,
                planoId: plano.id,
                valorDoPlanoCent: planoCent,
                valorRecebidoCent: recebidoCent,
                descontoMotivo: String(f.get('descontoMotivo') ?? '') || null,
                parcelas: Number(f.get('parcelas') ?? 1) || 1,
                validadeDe: String(f.get('validadeDe') ?? de),
                validadeAte: String(f.get('validadeAte') ?? '') || null,
                forma: String(f.get('forma') ?? 'credito') as Forma,
                recebidoEm: String(f.get('recebidoEm') ?? hoje),
                observacoes: String(f.get('observacoes') ?? '') || null,
                cpf: cpf || null,
                matricula: matricula || null,
              })
              if (!r.ok) return setErro(r.erro)
              fechar()
              router.push(`/recibos/${r.valor}`)
            })
          }}
        >
          <Campo rotulo="Aluno" htmlFor="nr-aluno" obrigatorio>
            {aluno ? (
              <span className="flex min-h-11 items-center justify-between gap-2 rounded-padrao border border-linha bg-superficie px-3 text-[14.5px]">
                <span className="flex min-w-0 items-center gap-2.5">
                  <Avatar nome={aluno.nome} tamanho={24} decorativo />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{aluno.nome}</span>
                    {aluno.detalhe ? <span className="text-[12px] text-tinta-media">{aluno.detalhe}</span> : null}
                  </span>
                </span>
                <button
                  type="button" onClick={() => { setAluno(null); setTermo(''); setCpf(''); setMatricula('') }}
                  className="cursor-pointer text-[13.5px] text-tinta-media hover:text-tinta"
                >
                  Trocar
                </button>
              </span>
            ) : (
              <div className="flex flex-col gap-1">
                <input
                  id="nr-aluno" value={termo} onChange={(e) => setTermo(e.target.value)}
                  placeholder="Buscar pelo nome do aluno" className={entrada} autoComplete="off" autoFocus
                />
                {termo.trim().length >= 2 && achados.length ? (
                  <ul className="flex max-h-44 flex-col overflow-y-auto rounded-padrao border border-linha-suave bg-superficie">
                    {achados.slice(0, 8).map((x) => (
                      <li key={x.id}>
                        <button
                          type="button" onClick={() => escolherAluno(x)}
                          className="flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left hover:bg-superficie-suave"
                        >
                          <Avatar nome={x.nome} tamanho={32} decorativo />
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate text-[14.5px] font-medium">{x.nome}</span>
                            {x.detalhe ? <span className="text-[12px] text-tinta-media">{x.detalhe}</span> : null}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}
          </Campo>

          {aluno ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo rotulo="CPF" htmlFor="nr-cpf">
                <input
                  id="nr-cpf" value={cpf} onChange={(e) => setCpf(e.target.value)}
                  inputMode="numeric" maxLength={14} placeholder="Exemplo: 050.629.576-13" className={entrada}
                />
              </Campo>
              <Campo rotulo="Matrícula" htmlFor="nr-matricula">
                <input
                  id="nr-matricula" value={matricula} onChange={(e) => setMatricula(e.target.value)}
                  maxLength={20} placeholder="Exemplo: 295" className={entrada}
                />
              </Campo>
            </div>
          ) : null}

          <Campo rotulo="Plano" htmlFor="nr-plano" obrigatorio>
            <Escolha
              id="nr-plano" nome="plano" valorInicial={planoId} placeholder="Selecione o plano"
              aoTrocar={escolherPlano}
              opcoes={planos.map((p) => ({
                valor: p.id,
                rotulo: /^plano\b/i.test(p.nome) ? p.nome : `Plano ${p.nome}`,
                detalhe: p.parcelas > 1
                  ? `${emReais(p.precoCent)} · ${p.parcelas}x de ${emReais(Math.round(p.precoCent / p.parcelas))}`
                  : emReais(p.precoCent),
              }))}
            />
          </Campo>

          {plano ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo rotulo="Período, de" htmlFor="nr-de" obrigatorio>
                  <CampoData id="nr-de" nome="validadeDe" valorInicial={de} aoTrocar={(v) => v && setDe(v)} limpavel={false} />
                </Campo>
                <Campo rotulo="Até" htmlFor="nr-ate">
                  {/* a chave refaz o campo quando o plano ou o início mudam: a
                      sugestão acompanha, e o que se digitar depois vale */}
                  <CampoData key={`${planoId}-${de}`} id="nr-ate" nome="validadeAte" valorInicial={ate ?? ''} />
                </Campo>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Campo rotulo="Valor do plano" htmlFor="nr-plano-valor">
                  <CampoDinheiro id="nr-plano-valor" valor={valorPlano} aoMudar={setValorPlano} />
                </Campo>
                <Campo rotulo="Valor recebido" htmlFor="nr-recebido">
                  <CampoDinheiro id="nr-recebido" valor={recebido} aoMudar={setRecebido} />
                </Campo>
              </div>

              {descontoCent > 0 ? (
                <Campo rotulo={`Motivo do desconto (${emReais(descontoCent)})`} htmlFor="nr-motivo" obrigatorio>
                  <input
                    id="nr-motivo" name="descontoMotivo" maxLength={120}
                    placeholder="Exemplo: suspensão de dependentes" className={entrada}
                  />
                </Campo>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,.6fr)_minmax(0,1fr)]">
                <Campo rotulo="Pagamento" htmlFor="nr-forma">
                  <Escolha id="nr-forma" nome="forma" valorInicial="credito" opcoes={FORMAS} />
                </Campo>
                <Campo rotulo="Parcelas" htmlFor="nr-parcelas">
                  <CampoNumero key={planoId} id="nr-parcelas" nome="parcelas" min={1} max={24} valorInicial={plano.parcelas} />
                </Campo>
                <Campo rotulo="Pago em" htmlFor="nr-recebido-em">
                  <CampoData id="nr-recebido-em" nome="recebidoEm" valorInicial={hoje} limpavel={false} />
                </Campo>
              </div>

              <Campo rotulo="Observações" htmlFor="nr-obs">
                <input
                  id="nr-obs" name="observacoes" maxLength={200}
                  placeholder="Exemplo: renovação antecipada" className={entrada}
                />
              </Campo>

              <Nota tom="neutro">
                A emissão do recibo não gera lançamento no Financeiro. O
                recebimento deve ser registrado no contrato do aluno.
              </Nota>
            </>
          ) : null}

          {erro ? <Nota tom="alerta">{erro}</Nota> : null}
        </ModalFormulario>
      ) : null}
    </>
  )
}
