'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Menu } from '@/components/ui/menu'
import { Modal, ModalFormulario } from '@/components/ui/modal'
import { Avatar, Campo, Nota, Vazio, entrada } from '@/components/ui/pecas'
import { Icone, type NomeIcone } from '@/components/ui/icones'
import { CampoData } from '@/components/ui/campo-data'
import { Escolha } from '@/components/ui/escolha'
import { useAviso } from '@/components/ui/desfazer'
import {
  cancelarCobranca, corrigirValor, estornarPagamento, reabrirCobranca,
  registrarPagamento,
} from '@/server/financeiro/acoes'
import { emitirRecibo } from '@/server/recibo/acoes'
import type { CobrancaLinha } from '@/server/financeiro/consultas'
import { emCentavos, emReais } from '@/core/planos/plano'
import { competenciaCurta } from '@/core/financeiro/cobranca'
import { ROTULO_FORMA, type Forma } from '@/core/financeiro/fechamento'
import { dataCurta } from '@/core/agenda/datas'
import { erroLegivel } from '@/core/erro-legivel'

/**
 * A lista do caixa, e o que se faz com cada linha.
 *
 * Receber é **dois cliques**: o botão da linha abre o modal já preenchido com o
 * que falta, a data de hoje e a forma que o contrato diz, e o segundo confirma.
 * Quem usa isto está entre um aluno e outro, com o telefone tocando, e todo
 * campo a mais atrasa a fila da recepção.
 */

const FORMAS = (Object.keys(ROTULO_FORMA) as Forma[])
  .map((valor) => ({ valor, rotulo: ROTULO_FORMA[valor] }))

/** A situação em quatro lugares do cartão: faixa, borda, etiqueta e glifo. */
const SITUACAO: Record<string, {
  faixa: string; borda: string; etiqueta: string; icone: NomeIcone
}> = {
  atrasada: {
    faixa: 'border-l-alerta', borda: 'border-alerta-linha',
    etiqueta: 'bg-alerta-fundo text-alerta', icone: 'aviso',
  },
  aberta: {
    faixa: 'border-l-linha', borda: 'border-linha-suave',
    etiqueta: 'bg-neutro-fundo text-tinta-media', icone: 'relogio',
  },
  parcial: {
    faixa: 'border-l-atencao', borda: 'border-atencao-linha',
    etiqueta: 'bg-atencao-fundo text-atencao', icone: 'relogio',
  },
  paga: {
    faixa: 'border-l-positivo', borda: 'border-linha-suave',
    etiqueta: 'bg-positivo-fundo text-positivo', icone: 'check',
  },
  cancelada: {
    faixa: 'border-l-linha-tracejada', borda: 'border-linha-suave',
    etiqueta: 'bg-neutro-fundo text-tinta-media', icone: 'proibido',
  },
}

const ROTULO_SITUACAO: Record<string, string> = {
  atrasada: 'Em atraso',
  aberta: 'Em aberto',
  parcial: 'Pago em parte',
  paga: 'Pago',
  cancelada: 'Cancelada',
}

type Modo =
  | { tipo: 'receber'; c: CobrancaLinha }
  | { tipo: 'cancelar'; c: CobrancaLinha }
  | { tipo: 'corrigir'; c: CobrancaLinha }
  | { tipo: 'estornar'; c: CobrancaLinha; pagamentoId: string; recibo: string | null }
  | { tipo: 'emitir'; c: CobrancaLinha; pagamentoId: string; valorCent: number }

export function ListaDeCobrancas({
  linhas, vazio,
}: {
  linhas: CobrancaLinha[]
  vazio: { titulo: string; texto: string }
}) {
  const [modo, setModo] = useState<Modo | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, comecar] = useTransition()
  const router = useRouter()
  const avisar = useAviso()

  const hoje = new Date().toLocaleDateString('en-CA')

  function agir(
    fn: () => Promise<{ ok: true } | { ok: false; erro: string }>, texto: string,
  ) {
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

  if (linhas.length === 0) {
    return <Vazio icone="dinheiro" titulo={vazio.titulo} texto={vazio.texto} />
  }

  return (
    <div className="flex flex-col gap-2.5">
      {linhas.map((c) => {
        const falta = Math.max(0, c.valorCent - c.valorPagoCent)
        const recebivel = c.situacao !== 'paga' && c.situacao !== 'cancelada'
        const s = SITUACAO[c.situacao] ?? SITUACAO.aberta
        return (
          <article
            key={c.id}
            className={`rounded-grande border border-l-4 bg-superficie py-3.5 pr-4 pl-4 shadow-[0_1px_2px_rgba(20,26,24,.04)] transition-shadow hover:shadow-elevado ${s.borda} ${s.faixa}`}
          >
            {/*
              * A borda da esquerda é a situação, lida de relance: numa lista de
              * quarenta cobranças o olho procura o vermelho antes de ler nome.
              * Ela nunca anda sozinha, a etiqueta à direita diz o mesmo em texto.
              * É borda, e não faixa por cima com `overflow-hidden`: o recorte
              * engolia o menu dos três pontos, que abre para fora do cartão.
              */}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
              <span className="flex min-w-[220px] flex-1 items-center gap-3">
                <Avatar nome={c.pessoaNome} tamanho={40} decorativo />
                <span className="flex min-w-0 flex-col gap-1">
                  <Link
                    href={`/pessoas/${c.pessoaId}?aba=contratos`}
                    className="truncate text-[15px] font-semibold text-tinta hover:underline"
                  >
                    {c.pessoaNome}
                  </Link>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-tinta-media">
                    <span className="rounded-minima bg-superficie-mais-suave px-1.5 py-0.5 font-medium text-tinta-media">
                      {c.planoNome || 'Sem plano'}
                    </span>
                    <span>ref. {competenciaCurta(c.competencia)}</span>
                    <span aria-hidden className="text-linha-tracejada">•</span>
                    <span className="inline-flex items-center gap-1">
                      <Icone nome="relogio" tamanho={13} />
                      vence {dataCurta(c.vencimento)}
                    </span>
                  </span>
                </span>
              </span>

              <span className="flex items-center gap-3">
                <span className="flex flex-col items-end">
                  <span className="font-titulo text-[18px] leading-none font-semibold tracking-[-.01em] text-tinta tabular-nums">
                    {emReais(c.valorCent)}
                  </span>
                  {c.valorPagoCent > 0 && falta > 0 ? (
                    <span className="mt-1 text-[12px] text-tinta-media">
                      faltam {emReais(falta)}
                    </span>
                  ) : null}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-medium ${s.etiqueta}`}
                >
                  <Icone nome={s.icone} tamanho={13} />
                  {ROTULO_SITUACAO[c.situacao]}
                  {c.situacao === 'atrasada' ? ` · ${c.diasDeAtraso}d` : ''}
                </span>
              </span>

              {recebivel || c.situacao === 'cancelada' ? (
                <span className="flex flex-wrap items-center gap-2 sm:min-w-[196px] sm:justify-end">
                  {recebivel ? (
                    <Miudo primario onClick={() => setModo({ tipo: 'receber', c })}>
                      Receber
                    </Miudo>
                  ) : null}
                  {/* o telefone à mão: a lista de atraso existe para alguém ligar */}
                  {c.situacao === 'atrasada' && c.telefone ? (
                    <a
                      href={`tel:${c.telefone.replace(/\D/g, '')}`}
                      className="inline-flex min-h-9 items-center rounded-peca border border-linha-suave bg-superficie px-3 text-[13.5px] text-tinta-media hover:bg-superficie-mais-suave"
                    >
                      Ligar
                    </a>
                  ) : null}
                  {c.situacao === 'cancelada' ? (
                    <Miudo onClick={() => agir(() => reabrirCobranca(c.id), 'Cobrança reaberta')}>
                      Reabrir
                    </Miudo>
                  ) : null}
                  {/*
                    * Receber e ligar ficam à vista porque são o que se faz o tempo
                    * todo; corrigir e cancelar moram no menu, senão cada linha da
                    * lista vira uma barra de ferramentas de quatro botões, e o
                    * vermelho do cancelar disputa atenção com a ação principal.
                    */}
                  {recebivel && c.valorPagoCent === 0 ? (
                    <Menu
                      titulo={`Mais sobre a cobrança de ${c.pessoaNome}`}
                      itens={[
                        {
                          rotulo: 'Corrigir o valor',
                          icone: 'lapis',
                          aoEscolher: () => setModo({ tipo: 'corrigir', c }),
                        },
                        {
                          rotulo: 'Cancelar a cobrança',
                          icone: 'proibido',
                          perigo: true,
                          aoEscolher: () => setModo({ tipo: 'cancelar', c }),
                        },
                      ]}
                    />
                  ) : null}
                </span>
              ) : null}
            </div>

            {c.motivoCancelamento ? (
              <p className="mt-3 rounded-padrao bg-superficie-suave px-3 py-2 text-[12.5px] text-tinta-media">
                Cancelada: {c.motivoCancelamento}
              </p>
            ) : null}

            {c.pagamentos.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-1.5">
                {c.pagamentos.map((p) => (
                  <li
                    key={p.id}
                    className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-padrao px-3 py-2 text-[13px] ${
                      p.estornado ? 'bg-superficie-suave' : 'bg-positivo-superficie'
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`flex size-6 shrink-0 items-center justify-center rounded-full ${
                        p.estornado ? 'bg-neutro-fundo text-tinta-fraca' : 'bg-positivo-fundo text-positivo'
                      }`}
                    >
                      <Icone nome={p.estornado ? 'x' : 'check'} tamanho={13} />
                    </span>
                    <span className={`flex flex-1 flex-wrap items-center gap-x-2 ${p.estornado ? 'text-tinta-fraca' : 'text-tinta'}`}>
                      <span className={`font-medium tabular-nums ${p.estornado ? 'line-through' : ''}`}>
                        {p.estornado ? 'Estornado' : 'Recebido'} {emReais(p.valorCent)}
                      </span>
                      <span className="text-tinta-media">
                        {ROTULO_FORMA[p.forma]} · {dataCurta(p.recebidoEm)}
                      </span>
                      {p.estornado ? (
                        <span className="text-[12.5px] text-tinta-media">
                          motivo: {p.motivoEstorno}
                        </span>
                      ) : null}
                    </span>
                    {p.estornado ? null : (
                      <span className="flex items-center gap-1.5">
                        {/*
                          * O recibo nasce daqui, da linha do pagamento, que é
                          * onde a pessoa pede o papel. Emitir não é automático:
                          * a maior parte dos pagamentos de um estúdio pequeno
                          * não vira recibo, e gastar número de sequência com o
                          * que ninguém pediu é o mesmo buraco do cancelamento,
                          * sem nem a desculpa de ter havido um erro.
                          */}
                        {p.recibo ? (
                          <Link
                            href={`/recibos/${p.recibo.id}`}
                            className="inline-flex min-h-8 items-center gap-1.5 rounded-peca px-2 text-[12.5px] font-medium text-marca hover:bg-superficie"
                          >
                            <Icone nome="recibo" tamanho={14} />
                            {p.recibo.descricao}
                            {p.recibo.cancelado ? ' (cancelado)' : ''}
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setModo({
                              tipo: 'emitir', c, pagamentoId: p.id, valorCent: p.valorCent,
                            })}
                            disabled={pendente}
                            className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-peca border border-positivo-linha bg-superficie px-2.5 text-[12.5px] font-medium text-marca hover:border-marca disabled:opacity-50"
                          >
                            <Icone nome="recibo" tamanho={14} />
                            Emitir recibo
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setModo({
                            tipo: 'estornar', c, pagamentoId: p.id,
                            recibo: p.recibo && !p.recibo.cancelado ? p.recibo.descricao : null,
                          })}
                          className="inline-flex min-h-8 cursor-pointer items-center rounded-peca px-2 text-[12.5px] text-tinta-media hover:bg-superficie hover:text-alerta"
                        >
                          Estornar
                        </button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        )
      })}

      {modo?.tipo === 'receber' ? (
        <ModalFormulario
          aberto
          glifo="R$"
          tom="positivo"
          titulo="Registrar pagamento"
          sub={`${modo.c.pessoaNome} · ${competenciaCurta(modo.c.competencia)}`}
          primario="Registrar"
          pendente={pendente}
          aoFechar={() => { setModo(null); setErro(null) }}
          aoEnviar={(f) => {
            const cent = emCentavos(String(f.get('valor') ?? ''))
            if (cent === null || cent <= 0) {
              return setErro('Escreva o valor recebido, em reais.')
            }
            agir(() => registrarPagamento({
              cobrancaId: modo.c.id,
              valorCent: cent,
              forma: String(f.get('forma') ?? 'pix') as Forma,
              recebidoEm: String(f.get('recebidoEm') ?? hoje),
              observacao: String(f.get('observacao') ?? '') || null,
            }), 'Pagamento registrado')
          }}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo rotulo="Valor recebido" htmlFor="pg-valor" obrigatorio>
              <input
                id="pg-valor" name="valor" className={entrada} inputMode="decimal"
                defaultValue={(Math.max(0, modo.c.valorCent - modo.c.valorPagoCent) / 100)
                  .toFixed(2).replace('.', ',')}
              />
            </Campo>
            <Campo rotulo="Forma" htmlFor="pg-forma">
              <Escolha
                id="pg-forma" nome="forma" opcoes={FORMAS}
                valorInicial={modo.c.formaSugerida ?? 'pix'}
              />
            </Campo>
            <Campo rotulo="Recebido em" htmlFor="pg-data" obrigatorio>
              <CampoData id="pg-data" nome="recebidoEm" valorInicial={hoje} limpavel={false} />
            </Campo>
          </div>
          <Campo rotulo="Observação" htmlFor="pg-obs" dica="opcional">
            <input id="pg-obs" name="observacao" maxLength={120} className={entrada} />
          </Campo>
          <Nota tom="neutro">
            O valor vem preenchido com o que falta, e aceita mais ou menos que
            isso: quem paga metade hoje paga a outra metade depois, e as duas
            entradas ficam com a data delas.
          </Nota>
          {erro ? <Nota tom="alerta">{erro}</Nota> : null}
        </ModalFormulario>
      ) : null}

      {/* o botão de fechar não se chama "Cancelar" aqui: dois botões lado a
          lado com a mesma palavra, um para desistir e o outro para executar, é
          a hora errada de ela ter dois sentidos */}
      {modo?.tipo === 'cancelar' ? (
        <ModalFormulario
          aberto
          glifo="⨯"
          tom="alerta"
          titulo="Cancelar a cobrança"
          sub={`${modo.c.pessoaNome} · ${competenciaCurta(modo.c.competencia)}`}
          primario="Confirmar cancelamento"
          secundario="Voltar"
          perigo
          pendente={pendente}
          aoFechar={() => { setModo(null); setErro(null) }}
          aoEnviar={(f) => agir(
            () => cancelarCobranca(modo.c.id, String(f.get('motivo') ?? '')),
            'Cobrança cancelada')}
        >
          <Campo rotulo="Motivo" htmlFor="cb-motivo" obrigatorio>
            <input
              id="cb-motivo" name="motivo" maxLength={120} className={entrada}
              placeholder="Exemplo: cortesia combinada com a direção"
            />
          </Campo>
          <Nota tom="atencao">
            Ela sai da soma e continua na lista, com o motivo à vista. Cobrança
            que some sem explicação é a primeira coisa que ninguém consegue
            responder no fim do mês.
          </Nota>
          {erro ? <Nota tom="alerta">{erro}</Nota> : null}
        </ModalFormulario>
      ) : null}

      {modo?.tipo === 'corrigir' ? (
        <ModalFormulario
          aberto
          glifo="✎"
          tom="neutro"
          titulo="Corrigir o valor"
          sub={`${modo.c.pessoaNome} · ${competenciaCurta(modo.c.competencia)}`}
          primario="Corrigir"
          pendente={pendente}
          aoFechar={() => { setModo(null); setErro(null) }}
          aoEnviar={(f) => {
            const cent = emCentavos(String(f.get('valor') ?? ''))
            if (cent === null) return setErro('Escreva o valor, em reais.')
            agir(() => corrigirValor(modo.c.id, cent, String(f.get('motivo') ?? '')),
              'Valor corrigido')
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Valor" htmlFor="cr-valor" obrigatorio>
              <input
                id="cr-valor" name="valor" className={entrada} inputMode="decimal"
                defaultValue={(modo.c.valorCent / 100).toFixed(2).replace('.', ',')}
              />
            </Campo>
            <Campo rotulo="Motivo" htmlFor="cr-motivo" obrigatorio>
              <input
                id="cr-motivo" name="motivo" maxLength={120} className={entrada}
                placeholder="Exemplo: desconto de férias"
              />
            </Campo>
          </div>
          <Nota tom="neutro">
            O preço do contrato não muda: ele é o que foi vendido. O que muda é
            esta cobrança, e o motivo fica no histórico.
          </Nota>
          {erro ? <Nota tom="alerta">{erro}</Nota> : null}
        </ModalFormulario>
      ) : null}

      {modo?.tipo === 'estornar' ? (
        <ModalFormulario
          aberto
          glifo="↩"
          tom="alerta"
          titulo="Estornar o pagamento"
          sub={modo.c.pessoaNome}
          primario="Estornar"
          perigo
          pendente={pendente}
          aoFechar={() => { setModo(null); setErro(null) }}
          aoEnviar={(f) => agir(
            () => estornarPagamento(modo.pagamentoId, String(f.get('motivo') ?? '')),
            'Pagamento estornado')}
        >
          <Campo rotulo="Motivo" htmlFor="es-motivo" obrigatorio>
            <input
              id="es-motivo" name="motivo" maxLength={120} className={entrada}
              placeholder="Exemplo: digitado em dobro"
            />
          </Campo>
          <Nota tom="atencao">
            A linha continua no histórico, riscada, e sai das somas. Apagar
            faria o fechamento de ontem mudar de valor sozinho.
          </Nota>
          {/* o recibo cai junto com o pagamento, e descobrir isso depois, na
              lista de recibos, parecia um recibo cancelado por engano */}
          {modo.recibo ? (
            <Nota tom="alerta">
              O recibo {modo.recibo} será cancelado, com este motivo.
            </Nota>
          ) : null}
          {erro ? <Nota tom="alerta">{erro}</Nota> : null}
        </ModalFormulario>
      ) : null}

      {/*
        * Emitir gasta um número da série, e número de recibo não volta: o
        * cancelado fica no buraco da sequência para sempre. Um toque perdido
        * na linha do pagamento não pode custar isso sem perguntar.
        */}
      {modo?.tipo === 'emitir' ? (
        <Modal
          aberto
          icone="recibo"
          largura="confirmacao"
          titulo="Emitir recibo?"
          sub={`${modo.c.pessoaNome}, ${emReais(modo.valorCent)}`}
          primario="Emitir"
          secundario="Voltar"
          pendente={pendente}
          aoFechar={() => { setModo(null); setErro(null) }}
          aoConfirmar={() => agir(
            () => emitirRecibo(modo.pagamentoId), 'Recibo emitido')}
        >
          <p className="text-[14px] leading-[1.55] text-tinta-media">
            O recibo recebe o próximo número da série. Se sair errado, dá para
            corrigir ou cancelar, mas o número fica usado.
          </p>
          {erro ? <Nota tom="alerta">{erro}</Nota> : null}
        </Modal>
      ) : null}

      {erro && !modo ? <Nota tom="alerta">{erro}</Nota> : null}
    </div>
  )
}

function Miudo({
  children, perigo = false, primario = false, ...resto
}: {
  children: React.ReactNode
  perigo?: boolean
  /** a ação que a linha existe para oferecer: escura, como o botão primário */
  primario?: boolean
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...resto}
      className={`min-h-9 cursor-pointer rounded-peca border px-3 text-[13.5px] disabled:opacity-50 ${
        primario
          ? 'border-escuro bg-escuro font-medium text-tinta-clara hover:bg-escuro-hover'
          : perigo
          ? 'border-alerta-linha bg-superficie text-alerta hover:bg-alerta-superficie'
          : 'border-linha-suave bg-superficie text-tinta-media hover:bg-superficie-mais-suave'
      }`}
    >
      {children}
    </button>
  )
}
