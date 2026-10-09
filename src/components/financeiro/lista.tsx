'use client'

import { useFiltroLocal } from './busca'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Menu, type ItemMenu } from '@/components/ui/menu'
import { Modal, ModalFormulario } from '@/components/ui/modal'
import { Avatar, Campo, Nota, Vazio, entrada } from '@/components/ui/pecas'
import { CELULA_FIXA, Cabecalho, LINHA, Tabela, Th } from '@/components/ui/tabela'
import { CampoDinheiro } from '@/components/ui/campo-dinheiro'
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


/**
 * O WhatsApp da pessoa com a mensagem de cobrança já escrita, em tom de
 * lembrete. Quem manda revisa antes de enviar: o texto é ponto de partida.
 */
function linkDeCobranca(c: CobrancaLinha, faltaCent: number): string {
  const primeiro = c.pessoaNome.trim().split(/\s+/)[0] ?? ''
  const nome = primeiro.charAt(0).toUpperCase() + primeiro.slice(1).toLowerCase()
  const venc = `${c.vencimento.slice(8, 10)}/${c.vencimento.slice(5, 7)}`
  const texto = `Olá, ${nome}! Tudo bem? Passando para lembrar do pagamento de ${c.planoNome}, no valor de ${emReais(faltaCent)}, com vencimento em ${venc}. Qualquer dúvida, estamos à disposição.`
  const numero = c.telefone!.replace(/\D/g, '')
  return `https://wa.me/${numero.startsWith('55') ? numero : `55${numero}`}?text=${encodeURIComponent(texto)}`
}
export function ListaDeCobrancas({
  linhas: carregadas, vazio, naFicha = false,
}: {
  linhas: CobrancaLinha[]
  vazio: { titulo: string; texto: string }
  /**
   * Dentro da ficha a pessoa é sempre a mesma: avatar e nome em toda linha
   * eram a mesma informação repetida, e o plano sobe para o lugar do título.
   */
  naFicha?: boolean
}) {
  const { linhas, procurando } = useFiltroLocal(carregadas)
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
    return procurando
      ? <p className="px-1 py-6 text-center text-[14.5px] text-tinta-media">Procurando nas outras páginas</p>
      : <Vazio icone="dinheiro" titulo={vazio.titulo} texto={vazio.texto} />
  }

  return (
    <div className="flex flex-col gap-2.5">
      {/*
        * Tabela, não pilha de cartões: quarenta cobranças em cartões eram
        * quatro telas de rolagem, e o que se compara aqui (quem, quanto,
        * desde quando) se lê melhor em coluna. Receber fica à vista; o resto
        * mora no "⋮" da linha. A primeira coluna fica presa ao rolar de lado.
        */}
      <Tabela largura={880} soNoDesktop>
          <Cabecalho>
              <Th fixa>{naFicha ? 'Plano' : 'Aluno'}</Th>
              <Th className="max-md:hidden">Referência</Th>
              <Th className="max-md:hidden">Vencimento</Th>
              <Th className="text-right max-md:hidden">Valor</Th>
              <Th className="max-md:hidden">Situação</Th>
              <Th className="max-md:hidden">Recebimento</Th>
              <Th className="text-right max-md:hidden"><span className="sr-only">Ações</span></Th>
          </Cabecalho>
          <tbody>
            {linhas.map((c) => {
              const falta = Math.max(0, c.valorCent - c.valorPagoCent)
              const recebivel = c.situacao !== 'paga' && c.situacao !== 'cancelada'
              const s = SITUACAO[c.situacao] ?? SITUACAO.aberta
              const validos = c.pagamentos.filter((p) => !p.estornado)
              const ultimo = validos[validos.length - 1]
              // o recibo que falta emitir fica à vista na linha, e não só nos
              // três pontos: escondido, ninguém achava (MGM, 09/out/2026)
              const aEmitir = validos.filter((p) => !p.recibo).at(-1) ?? null
              const itens: ItemMenu[] = [
                // lembrete de cobrança em aberto; sem telefone, sem a opção
                ...(c.telefone && recebivel && falta > 0 ? [{
                  rotulo: 'Enviar mensagem',
                  icone: 'whatsapp' as const,
                  aoEscolher: () => window.open(linkDeCobranca(c, falta), '_blank', 'noopener'),
                }] : []),
                ...validos.filter((p) => p.recibo || p.id !== aEmitir?.id).map((p) => p.recibo
                  ? {
                      rotulo: `Ver ${p.recibo.descricao}${p.recibo.cancelado ? ' (cancelado)' : ''}`,
                      icone: 'recibo' as const,
                      aoEscolher: () => router.push(`/recibos/${p.recibo!.id}`),
                    }
                  : {
                      rotulo: `Emitir recibo de ${emReais(p.valorCent)}`,
                      icone: 'recibo' as const,
                      aoEscolher: () => setModo({ tipo: 'emitir', c, pagamentoId: p.id, valorCent: p.valorCent }),
                    }),
                ...(recebivel && c.valorPagoCent === 0 ? [{
                  rotulo: 'Corrigir o valor', icone: 'lapis' as const,
                  aoEscolher: () => setModo({ tipo: 'corrigir', c }),
                }] : []),
                ...validos.map((p) => ({
                  rotulo: `Estornar ${emReais(p.valorCent)} de ${dataCurta(p.recebidoEm)}`,
                  perigo: true,
                  aoEscolher: () => setModo({
                    tipo: 'estornar', c, pagamentoId: p.id,
                    recibo: p.recibo && !p.recibo.cancelado ? p.recibo.descricao : null,
                  }),
                })),
                ...(recebivel && c.valorPagoCent === 0 ? [{
                  rotulo: 'Cancelar a cobrança', icone: 'proibido' as const, perigo: true,
                  aoEscolher: () => setModo({ tipo: 'cancelar', c }),
                }] : []),
              ]
              return (
                <tr key={c.id} className={LINHA}>
                  <td className={CELULA_FIXA}>
                    <span className="flex min-w-[200px] items-start gap-3 md:items-center">
                      {naFicha ? null : <Avatar nome={c.pessoaNome} tamanho={32} decorativo />}
                      <span className="flex min-w-0 flex-col gap-0.5">
                        {naFicha ? (
                          <span className="truncate text-[14.5px] font-medium">{c.planoNome || 'Sem plano'}</span>
                        ) : (
                          <>
                            <Link
                              href={`/pessoas/${c.pessoaId}?aba=contratos`}
                              className="truncate text-[14.5px] font-medium text-tinta hover:underline"
                            >
                              {c.pessoaNome}
                            </Link>
                            <span className="truncate text-[12px] text-tinta-media">{c.planoNome || 'Sem plano'}</span>
                          </>
                        )}
                        {/* no celular as colunas secundárias somem, e o que
                            decide a cobrança desce para cá: valor, situação, vencimento */}
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 md:hidden">
                          <span className="text-[14.5px] font-semibold tabular-nums">
                            {emReais(falta > 0 && c.valorPagoCent > 0 ? falta : c.valorCent)}
                          </span>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium whitespace-nowrap ${s.etiqueta}`}>
                            {ROTULO_SITUACAO[c.situacao]}
                            {c.situacao === 'atrasada' ? ` há ${c.diasDeAtraso}d` : ''}
                          </span>
                          <span className="text-[12px] text-tinta-media tabular-nums">
                            vence {dataCurta(c.vencimento)}
                          </span>
                        </span>
                        <span className="flex items-center gap-1.5 pt-1.5 md:hidden">
                          {recebivel ? (
                            <Miudo primario onClick={() => setModo({ tipo: 'receber', c })}>
                              Receber
                            </Miudo>
                          ) : null}
                          {c.situacao === 'cancelada' ? (
                            <Miudo onClick={() => agir(() => reabrirCobranca(c.id), 'Cobrança reaberta')}>
                              Reabrir
                            </Miudo>
                          ) : null}
                          {aEmitir ? (
                            <Miudo onClick={() => setModo({ tipo: 'emitir', c, pagamentoId: aEmitir.id, valorCent: aEmitir.valorCent })}>
                              Emitir recibo
                            </Miudo>
                          ) : null}
                          {itens.length ? (
                            <Menu titulo={`Mais sobre a cobrança de ${c.pessoaNome}`} itens={itens} />
                          ) : <span className="inline-block w-[34px]" />}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[13.5px] whitespace-nowrap text-tinta-media capitalize max-md:hidden">
                    {competenciaCurta(c.competencia)}
                  </td>
                  <td className="px-4 py-3 text-[13.5px] whitespace-nowrap tabular-nums max-md:hidden">
                    {dataCurta(c.vencimento)}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap max-md:hidden">
                    <span className="block text-[14.5px] font-semibold tabular-nums">{emReais(c.valorCent)}</span>
                    {c.valorPagoCent > 0 && falta > 0 ? (
                      <span className="block text-[12px] text-tinta-media tabular-nums">falta {emReais(falta)}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 max-md:hidden">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium whitespace-nowrap ${s.etiqueta}`}>
                      <Icone nome={s.icone} tamanho={13} />
                      {ROTULO_SITUACAO[c.situacao]}
                      {c.situacao === 'atrasada'
                        ? ` há ${c.diasDeAtraso} ${c.diasDeAtraso === 1 ? 'dia' : 'dias'}`
                        : ''}
                    </span>
                    {c.motivoCancelamento ? (
                      <span className="mt-1 block max-w-[220px] truncate text-[12px] text-tinta-media" title={c.motivoCancelamento}>
                        {c.motivoCancelamento}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-[13.5px] whitespace-nowrap max-md:hidden">
                    {ultimo ? (
                      <span className="flex flex-col">
                        <span className="tabular-nums">{emReais(c.valorPagoCent)}</span>
                        <span className="text-[12px] text-tinta-media">
                          {ROTULO_FORMA[ultimo.forma]} · {dataCurta(ultimo.recebidoEm)}
                          {validos.length > 1 ? ` (+${validos.length - 1})` : ''}
                        </span>
                        {validos.filter((p) => p.recibo).map((p) => (
                          <Link
                            key={p.id}
                            href={`/recibos/${p.recibo!.id}`}
                            className="inline-flex items-center gap-1 text-[12px] font-medium text-marca hover:underline"
                          >
                            <Icone nome="recibo" tamanho={12} />
                            {p.recibo!.descricao}
                            {p.recibo!.cancelado ? ' (cancelado)' : ''}
                          </Link>
                        ))}
                      </span>
                    ) : c.pagamentos.some((p) => p.estornado) ? (
                      <span className="flex flex-col">
                        <span className="text-tinta-media">Estornado</span>
                        <span className="max-w-[200px] truncate text-[12px] text-tinta-media">
                          {c.pagamentos.find((p) => p.estornado)?.motivoEstorno}
                        </span>
                      </span>
                    ) : (
                      <span className="text-tinta-fraca">Nenhum</span>
                    )}
                  </td>
                  <td className="px-4 py-3 max-md:hidden">
                    <span className="flex items-center justify-end gap-1.5">
                      {recebivel ? (
                        <Miudo primario onClick={() => setModo({ tipo: 'receber', c })}>
                          Receber
                        </Miudo>
                      ) : null}
                      {c.situacao === 'cancelada' ? (
                        <Miudo onClick={() => agir(() => reabrirCobranca(c.id), 'Cobrança reaberta')}>
                          Reabrir
                        </Miudo>
                      ) : null}
                      {aEmitir ? (
                        <Miudo onClick={() => setModo({ tipo: 'emitir', c, pagamentoId: aEmitir.id, valorCent: aEmitir.valorCent })}>
                          Emitir recibo
                        </Miudo>
                      ) : null}
                      {itens.length ? (
                        <Menu titulo={`Mais sobre a cobrança de ${c.pessoaNome}`} itens={itens} />
                      ) : <span className="inline-block w-[34px]" />}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
      </Tabela>

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
              <CampoDinheiro
                id="pg-valor" nome="valor"
                valorInicial={emReais(Math.max(0, modo.c.valorCent - modo.c.valorPagoCent))}
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
              <CampoDinheiro id="cr-valor" nome="valor" valorInicial={emReais(modo.c.valorCent)} />
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
          <p className="text-[14.5px] leading-[1.55] text-tinta-media">
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
