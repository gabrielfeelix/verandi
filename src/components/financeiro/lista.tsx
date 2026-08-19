'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Menu } from '@/components/ui/menu'
import { ModalFormulario } from '@/components/ui/modal'
import { Campo, Nota, Vazio, entrada } from '@/components/ui/pecas'
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

const TINTA_SITUACAO: Record<string, string> = {
  atrasada: 'bg-alerta-fundo text-alerta',
  aberta: 'bg-neutro-fundo text-tinta-media',
  parcial: 'bg-atencao-fundo text-atencao',
  paga: 'bg-positivo-fundo text-positivo',
  cancelada: 'bg-neutro-fundo text-tinta-media',
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
  | { tipo: 'estornar'; c: CobrancaLinha; pagamentoId: string }

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
    <div className="flex flex-col gap-2">
      {linhas.map((c) => {
        const falta = Math.max(0, c.valorCent - c.valorPagoCent)
        const recebivel = c.situacao !== 'paga' && c.situacao !== 'cancelada'
        return (
          <div
            key={c.id}
            className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-media border px-3.5 py-3 ${
              c.situacao === 'atrasada'
                ? 'border-alerta-linha bg-superficie'
                : 'border-linha-suave bg-superficie'
            }`}
          >
            <span className="flex min-w-[190px] flex-1 flex-col">
              <Link
                href={`/pessoas/${c.pessoaId}?aba=contratos`}
                className="text-[13.5px] font-medium hover:underline"
              >
                {c.pessoaNome}
              </Link>
              <span className="text-[12px] text-tinta-media">
                {c.planoNome || 'Sem plano'} · {competenciaCurta(c.competencia)}
                {' · vence '}{dataCurta(c.vencimento)}
              </span>
            </span>

            <span className="flex flex-col items-end">
              <span className="font-mono text-[13.5px]">{emReais(c.valorCent)}</span>
              {c.valorPagoCent > 0 && falta > 0 ? (
                <span className="text-[11.5px] text-tinta-media">
                  faltam {emReais(falta)}
                </span>
              ) : null}
            </span>

            <span
              className={`rounded-peca px-2.5 py-[5px] text-[11.5px] font-medium ${TINTA_SITUACAO[c.situacao]}`}
            >
              {ROTULO_SITUACAO[c.situacao]}
              {c.situacao === 'atrasada' ? ` · ${c.diasDeAtraso}d` : ''}
            </span>

            <span className="flex flex-wrap gap-2">
              {recebivel ? (
                <Miudo onClick={() => setModo({ tipo: 'receber', c })}>Receber</Miudo>
              ) : null}
              {/* o telefone à mão: a lista de atraso existe para alguém ligar */}
              {c.situacao === 'atrasada' && c.telefone ? (
                <a
                  href={`tel:${c.telefone.replace(/\D/g, '')}`}
                  className="inline-flex min-h-9 items-center rounded-peca border border-linha-suave bg-superficie px-3 text-[12.5px] text-tinta-media hover:bg-superficie-mais-suave"
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

            {c.motivoCancelamento ? (
              <p className="w-full text-[11.5px] text-tinta-media">
                Cancelada: {c.motivoCancelamento}
              </p>
            ) : null}

            {c.pagamentos.length > 0 ? (
              <ul className="flex w-full flex-col gap-1 border-t border-linha-suave pt-2">
                {c.pagamentos.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-2 text-[12px]">
                    <span className={p.estornado ? 'text-tinta-fraca line-through' : ''}>
                      {emReais(p.valorCent)} · {ROTULO_FORMA[p.forma]} ·{' '}
                      {dataCurta(p.recebidoEm)}
                    </span>
                    {p.estornado ? (
                      <span className="text-[11.5px] text-tinta-media">
                        estornado: {p.motivoEstorno}
                      </span>
                    ) : (
                      <>
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
                            className="text-[11.5px] text-marca underline"
                          >
                            {p.recibo.descricao}
                            {p.recibo.cancelado ? ' (cancelado)' : ''}
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() => agir(
                              () => emitirRecibo(p.id), 'Recibo emitido')}
                            disabled={pendente}
                            className="cursor-pointer text-[11.5px] text-marca underline disabled:opacity-50"
                          >
                            emitir recibo
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setModo({ tipo: 'estornar', c, pagamentoId: p.id })}
                          className="cursor-pointer text-[11.5px] text-tinta-media underline"
                        >
                          estornar
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
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
              placeholder="Ex.: cortesia combinada com a dona"
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
                placeholder="Ex.: desconto de férias"
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
              placeholder="Ex.: digitado em dobro"
            />
          </Campo>
          <Nota tom="atencao">
            A linha continua no histórico, riscada, e sai das somas. Apagar
            faria o fechamento de ontem mudar de valor sozinho.
          </Nota>
          {erro ? <Nota tom="alerta">{erro}</Nota> : null}
        </ModalFormulario>
      ) : null}

      {erro && !modo ? <Nota tom="alerta">{erro}</Nota> : null}
    </div>
  )
}

function Miudo({
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
