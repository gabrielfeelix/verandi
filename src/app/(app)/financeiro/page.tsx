import Link from 'next/link'
import { OPERA, clienteServidor, exigirPapel } from '@/server/conta'
import { hojeEm } from '@/server/agenda/fuso'
import { materializarCobrancas } from '@/server/financeiro/materializar'
import {
  contarAtrasadas, listarCobrancas, materialDoFechamento, POR_PAGINA,
  resumoDasCobrancas, TETO_DO_RESUMO, type FiltroCobranca,
} from '@/server/financeiro/consultas'
import {
  aReceber, carteira, clientes, descontoDeVinculo, emAtraso, estornosDoPeriodo,
  faturamentoPor, recebidoPorForma,
} from '@/core/financeiro/fechamento'
import { competenciaDe } from '@/core/financeiro/cobranca'
import { recibosDoPeriodo } from '@/server/recibo/consultas'
import { emReais } from '@/core/planos/plano'
import { dataCurta, somarDias } from '@/core/agenda/datas'
import { ListaDeCobrancas } from '@/components/financeiro/lista'
import { ProvedorDeAviso } from '@/components/ui/desfazer'
import { BuscaDeCobranca, ProvedorDeBusca } from '@/components/financeiro/busca'
import { Avatar, Paginacao, Vazio, cartao } from '@/components/ui/pecas'
import { BarraDePeriodo } from '@/components/ui/barra-periodo'
import { FaixaDeNumeros, type NumeroDaFaixa } from '@/components/ui/faixa-numeros'
import { periodoDaBusca } from '@/core/financeiro/periodo'
import type { ResumoDeCobrancas } from '@/core/financeiro/metricas'
import { AreaQueTroca } from '@/components/ui/troca'
import { SecoesDoFinanceiro } from '@/components/financeiro/secoes'
import { Chip } from '@/components/ui/pecas'
import { Suspenso } from '@/components/ui/suspenso'
import Carregando from './loading'
import { TituloDaTela } from '@/components/ui/titulo-da-tela'

/**
 * O caixa da recepção.
 *
 * A tela abre em **Todas**, decisão do Gabriel em 01/out/2026: com o cartão
 * quitando as próprias parcelas, abrir em "Em atraso" mostrava meia dúzia de
 * linhas e escondia o caixa. O atraso continua a um clique, com o contador na
 * aba e no rail, e o atalho da tela inicial ainda leva direto a ele. O
 * fechamento é a última aba, e é onde "quanto faturamos" mora.
 */

const ABAS: Array<{ id: FiltroCobranca | 'fechamento'; rotulo: string }> = [
  { id: 'todas', rotulo: 'Todas' },
  { id: 'atrasadas', rotulo: 'Em atraso' },
  { id: 'a_vencer', rotulo: 'A vencer' },
  { id: 'pagas', rotulo: 'Recebidas' },
  { id: 'canceladas', rotulo: 'Canceladas' },
  { id: 'fechamento', rotulo: 'Fechamento' },
]

type Busca = Promise<{ aba?: string; q?: string; p?: string; de?: string; ate?: string; datas?: string; ordem?: string }>

export default async function Financeiro({ searchParams }: { searchParams: Busca }) {
  // dinheiro é do dono e da recepção; quem atende cai onde ele trabalha
  const conta = await exigirPapel(OPERA, 'Financeiro')

  const { aba: abaBruta, q, p, de: deBruto, ate: ateBruto, datas, ordem: ordemBruta } = await searchParams
  // a ordem é escolha de quem usa: situação (o urgente no topo) ou nome
  const ordem = ordemBruta === 'nome' ? 'nome' as const : undefined
  const db = await clienteServidor()
  const hoje = hojeEm(conta.fuso)

  /*
   * As cobranças do período nascem aqui, na abertura da tela, como as sessões
   * da semana nascem ao abrir a agenda. Sem cron no plano gratuito, este é o
   * gatilho, e ele é idempotente: no dia 12 de um mês já materializado não há
   * nada a criar, que é o caso da esmagadora maioria das aberturas.
   */
  await materializarCobrancas(db, conta.contaId, hoje)

  const aba = (ABAS.find((a) => a.id === abaBruta)?.id ?? 'todas')
  const pagina = Math.max(1, Number(p) || 1)

  const atrasadas = await contarAtrasadas(db, conta.contaId, hoje)

  if (aba === 'fechamento') {
    const de = deBruto || competenciaDe(hoje)
    const ate = ateBruto || hoje
    return (
      <Fechamento
        contaId={conta.contaId} de={de} ate={ate} hoje={hoje} fuso={conta.fuso}
        atrasadas={atrasadas}
      />
    )
  }

  /*
   * A janela é por **vencimento**, e a barra diz isso com todas as letras.
   * Recortar "Recebidas" pela data do pagamento seria outra pergunta legítima,
   * e é a que o Fechamento responde: duas telas com a mesma barra significando
   * datas diferentes é o jeito mais rápido de os dois números discordarem sem
   * ninguém saber por quê.
   */
  const periodo = periodoDaBusca(deBruto, ateBruto)

  const [{ linhas, total }, { resumo, completo }] = await Promise.all([
    listarCobrancas(db, conta.contaId, hoje, {
      filtro: aba, busca: q, pagina, periodo, ordem,
    }),
    resumoDasCobrancas(db, conta.contaId, hoje, { filtro: aba, busca: q, periodo }),
  ])

  const endereco = (mudanca: (b: URLSearchParams) => void) => {
    const base = new URLSearchParams()
    base.set('aba', aba)
    if (q) base.set('q', q)
    if (periodo) { base.set('de', periodo.de); base.set('ate', periodo.ate) }
    if (ordem) base.set('ordem', ordem)
    mudanca(base)
    return `/financeiro?${base}`
  }

  const numeros = faixaDaAba(aba, resumo)

  return (
    <AreaQueTroca esqueleto={<Carregando />}>
    <ProvedorDeAviso>
      <div className="flex flex-col gap-4">
        <Cabecalho atrasadas={atrasadas} hoje={hoje} />
        <SecoesDoFinanceiro ativa="cobrancas" />
        <div className={`${cartao} flex flex-col gap-4 p-4`}>
          {/* uma barra só: situação à esquerda, busca e período à direita.
              Eram quatro faixas empilhadas (situação, números, período,
              busca), e a lista começava no meio da tela */}
          <ProvedorDeBusca servidor={q?.trim() ?? ''}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
              <Trilha aba={aba} q={q} periodo={periodo} atrasadas={atrasadas} ordem={ordem} />
              <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
                <div className="w-full sm:w-64">
                  <BuscaDeCobranca valorInicial={q?.trim() ?? ''} aba={aba} />
                </div>
                <BarraDePeriodo
                  base="/financeiro"
                  periodo={periodo}
                  hoje={hoje}
                  rotulo="Vencimento"
                  escondidos={{ aba, q, ordem }}
                  abrirDatas={datas === '1'}
                  menu
                />
                <Suspenso
                  rotulo={ordem === 'nome' ? 'Ordem: nome' : 'Ordem: situação'}
                  ativo={ordem === 'nome'}
                  itens={[
                    { rotulo: 'Situação (urgentes no topo)', href: endereco((b) => { b.delete('ordem'); b.delete('p') }), ativo: !ordem },
                    { rotulo: 'Nome (A a Z)', href: endereco((b) => { b.set('ordem', 'nome'); b.delete('p') }), ativo: ordem === 'nome' },
                  ]}
                />
              </div>
            </div>

            <FaixaDeNumeros
              compacta
              itens={numeros}
              aviso={completo ? null
                : `A soma cobre as primeiras ${TETO_DO_RESUMO.toLocaleString('pt-BR')} cobranças deste recorte. Filtre por data para fechar o número.`}
            />

            <ListaDeCobrancas
              linhas={linhas}
              vazio={VAZIO[aba]}
            />
          </ProvedorDeBusca>

          {total > POR_PAGINA ? (
            <Paginacao
              pagina={pagina} total={total} porPagina={POR_PAGINA}
              hrefDe={(n) => endereco((b) => b.set('p', String(n)))}
            />
          ) : null}
        </div>
      </div>
    </ProvedorDeAviso>
    </AreaQueTroca>
  )
}

const VAZIO: Record<FiltroCobranca, { titulo: string; texto: string }> = {
  todas: {
    titulo: 'Nenhuma cobrança ainda',
    texto: 'Elas nascem dos contratos em vigor. Se você esperava alguma aqui, confira se a pessoa tem contrato na ficha dela.',
  },
  atrasadas: {
    titulo: 'Ninguém em atraso',
    texto: 'Toda cobrança vencida está paga.',
  },
  a_vencer: {
    titulo: 'Nada a vencer por enquanto',
    texto: 'As cobranças nascem dos contratos em vigor, até o mês que vem. Se você esperava alguma aqui, confira se a pessoa tem contrato na ficha dela.',
  },
  pagas: {
    titulo: 'Nenhum pagamento registrado ainda',
    texto: 'O que for recebido aparece aqui, com a data e a forma de pagamento.',
  },
  canceladas: {
    titulo: 'Nenhuma cobrança cancelada',
    texto: 'Cobrança cancelada continua listada, com o motivo, para o mês fechar sem buraco sem explicação.',
  },
}

function Cabecalho({ atrasadas, hoje }: { atrasadas: number; hoje: string }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-5 gap-y-3">
      <div>
        <TituloDaTela tela="financeiro">
          Financeiro
        </TituloDaTela>
        <p className="pt-[3px] text-[14.5px] text-tinta-media">
          {atrasadas === 0
            ? `Nada em atraso hoje, ${dataCurta(hoje)}.`
            : `${atrasadas} ${atrasadas === 1 ? 'cobrança em atraso' : 'cobranças em atraso'}.`}
        </p>
      </div>
      <a
        href="/financeiro/exportar"
        download
        className="inline-flex min-h-11 items-center rounded-padrao border border-linha bg-superficie px-3.5 text-[14.5px] font-medium hover:bg-superficie-mais-suave"
      >
        Exportar
      </a>
    </header>
  )
}

/**
 * Que números a aba mostra.
 *
 * Não é a mesma faixa em toda aba de propósito: "em atraso" quer saber quanto
 * falta entrar e há quanto tempo, "recebidas" quer saber quanto entrou, e
 * "todas" quer o retrato. Repetir os quatro mesmos números em cinco abas é o
 * jeito de nenhum deles ser lido.
 */
function faixaDaAba(aba: FiltroCobranca, r: ResumoDeCobrancas): NumeroDaFaixa[] {
  const quantas = (n: number) => `${n} ${n === 1 ? 'cobrança' : 'cobranças'}`

  if (aba === 'pagas') {
    return [
      { rotulo: 'Entrou', valor: emReais(r.pagoCent), tom: 'positivo',
        nota: quantas(r.quantidade) },
      { rotulo: 'Cobrado', valor: emReais(r.totalCent),
        nota: 'o que essas cobranças somavam' },
      { rotulo: 'Valor médio', valor: emReais(r.ticketCent),
        nota: 'por cobrança' },
      { rotulo: 'Ainda em aberto', valor: emReais(r.abertoCent),
        tom: r.abertoCent > 0 ? 'atencao' : 'neutro',
        nota: r.abertoCent > 0 ? 'diferença de arredondamento ou pagamento parcial' : 'nada pendente aqui' },
    ]
  }

  if (aba === 'canceladas') {
    return [
      { rotulo: 'Canceladas', valor: String(r.quantidadeCancelada),
        nota: 'continuam na lista, com o motivo' },
      { rotulo: 'Valor cancelado', valor: emReais(r.canceladasCent),
        nota: 'fora de toda soma de faturamento' },
    ]
  }

  const rotuloDoTotal = aba === 'atrasadas' ? 'Falta receber'
    : aba === 'a_vencer' ? 'Vai entrar' : 'Em aberto'

  return [
    {
      rotulo: rotuloDoTotal,
      valor: emReais(r.abertoCent),
      tom: aba === 'atrasadas' && r.abertoCent > 0 ? 'alerta' : 'neutro',
      nota: quantas(r.quantidadeAberta),
    },
    { rotulo: 'Já recebido', valor: emReais(r.pagoCent), tom: 'positivo',
      nota: 'destas mesmas cobranças' },
    { rotulo: 'Cobrado', valor: emReais(r.totalCent),
      nota: quantas(r.quantidade - r.quantidadeCancelada) },
  ]
}

function Trilha({
  aba, q, periodo, atrasadas, ordem,
}: {
  aba: string
  ordem?: 'nome'
  q?: string
  periodo: { de: string; ate: string } | null
  atrasadas: number
}) {
  // a situação é filtro dentro de Cobranças, em chips: as seções do
  // Financeiro já são as abas de cima, e duas fileiras de abas competiam
  return (
    <nav aria-label="Situação da cobrança" className="flex flex-wrap gap-1.5">
      {ABAS.filter((a) => a.id !== 'fechamento').map((a) => {
        const busca = new URLSearchParams({ aba: a.id })
        if (q) busca.set('q', q)
        // o período atravessa a troca: quem filtrou setembro e clicou em
        // "Recebidas" quer as recebidas de setembro, e não recomeçar
        if (periodo) { busca.set('de', periodo.de); busca.set('ate', periodo.ate) }
        if (ordem) busca.set('ordem', ordem)
        return (
          <Chip key={a.id} ativo={a.id === aba} href={`/financeiro?${busca}`}>
            {a.rotulo}
            {a.id === 'atrasadas' && atrasadas > 0 ? (
              <span
                className={`rounded-peca px-1.5 text-[12px] ${
                  a.id === aba ? 'bg-white/15' : 'bg-alerta-fundo text-alerta'
                }`}
              >
                {atrasadas}
              </span>
            ) : null}
          </Chip>
        )
      })}
    </nav>
  )
}

/**
 * As sete perguntas do item 4 do documento do cliente.
 *
 * Nenhuma é gráfico: número grande com uma linha embaixo dizendo o que ele
 * significa, e lista quando a lista é o ponto, que é o caso do atraso e do
 * faturamento por modalidade. Gráfico entra quando alguém pedir para comparar
 * dois períodos, e ninguém pediu.
 */
async function Fechamento({
  contaId, de, ate, hoje, fuso, atrasadas,
}: {
  contaId: string
  de: string
  ate: string
  hoje: string
  fuso: string
  atrasadas: number
}) {
  const db = await clienteServidor()
  const [material, recibos] = await Promise.all([
    materialDoFechamento(db, contaId, de, ate, hoje, fuso),
    // o terceiro relatório do item 4, e o último dos sete a ficar de pé
    recibosDoPeriodo(db, contaId, de, ate, fuso),
  ])

  const recebido = recebidoPorForma(material.pagamentos)
  const receber = aReceber(material.cobrancas, hoje)
  /*
   * O vencido é o de hoje, e não o do período. Com o período fechando em agosto
   * e a dívida vindo de junho, o cartão dizia "vencido e não pago: R$ 0,00" com
   * seis nomes em atraso listados logo abaixo. Dois números certos que juntos
   * mentem são piores que um número faltando.
   */
  const vencido = aReceber(material.atrasadas, hoje)
  // o atraso é de hoje, e não do período: quem deve desde junho é exatamente
  // quem se liga hoje
  const atraso = emAtraso(material.atrasadas, hoje)
  const porServico = faturamentoPor(material.pagamentos, 'servicoNome')
  const porPlano = faturamentoPor(material.pagamentos, 'planoNome')
  const cart = carteira(material.contratos, de, ate)
  const vinculo = descontoDeVinculo(material.contratos)
  const estornos = estornosDoPeriodo(material.estornos)
  const gente = clientes(material.pessoas, de, ate)

  const periodo = (rotulo: string, novoDe: string, novoAte: string) => (
    <Link
      key={rotulo}
      href={`/financeiro?aba=fechamento&de=${novoDe}&ate=${novoAte}`}
      // o mesmo chip da barra de período das listas, para as quatro seções
      // do Financeiro falarem a mesma língua
      className={`inline-flex min-h-9 items-center rounded-full border px-3 text-[14.5px] ${
        de === novoDe && ate === novoAte
          ? 'border-escuro bg-escuro font-medium text-tinta-clara'
          : 'border-linha bg-superficie text-tinta-media hover:bg-superficie-mais-suave'
      }`}
    >
      {rotulo}
    </Link>
  )

  const vencidoTotal = atraso.reduce((t, a) => t + a.totalCent, 0)
  const maiorForma = Math.max(1, ...recebido.porForma.map((f) => f.totalCent))

  return (
    <div className="flex flex-col gap-4">
      <Cabecalho atrasadas={atrasadas} hoje={hoje} />
      <SecoesDoFinanceiro ativa="fechamento" />

      <div className="flex flex-wrap items-center gap-2">
        {/* dia, semana, mês e ano são as quatro janelas que o documento pede */}
        {periodo('Hoje', hoje, hoje)}
        {periodo('Esta semana', somarDias(hoje, -6), hoje)}
        {periodo('Este mês', competenciaDe(hoje), hoje)}
        {periodo('Este ano', `${hoje.slice(0, 4)}-01-01`, hoje)}
        <span className="text-[13.5px] text-tinta-media">
          {dataCurta(de)} a {dataCurta(ate)}
        </span>
        <a
          href={`/financeiro/exportar?de=${de}&ate=${ate}`}
          download
          className="ml-auto inline-flex min-h-10 items-center rounded-media border border-linha bg-superficie px-3.5 text-[13.5px] font-medium hover:bg-superficie-mais-suave"
        >
          Baixar planilha
        </a>
      </div>

      {/*
        * O que entrou é a pergunta do fechamento, e ganha o cartão grande,
        * com a divisão por forma em barras. Os outros números ficam num
        * cartão só, sem a frase-explicação embaixo de cada um: eram cinco
        * cartões iguais, e nenhum se destacava.
        */}
      <div className="grid items-stretch gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section className={`${cartao} flex flex-col gap-4 p-5`}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-1.5">
              <h2 className="text-[13.5px] font-medium text-tinta-media">Entrou no período</h2>
              <p className="font-titulo text-[34px] leading-none font-semibold tracking-[-.02em] tabular-nums">
                {emReais(recebido.totalCent)}
              </p>
            </div>
          </div>
          {recebido.porForma.length ? (
            <ul className="flex flex-col gap-2.5">
              {recebido.porForma.map((f) => (
                <li key={f.rotulo} className="grid grid-cols-[120px_minmax(0,1fr)_auto] items-center gap-3 text-[13.5px]">
                  <span className="text-tinta-media">{f.rotulo}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-superficie-mais-suave">
                    <span
                      className="block h-full rounded-full bg-marca"
                      style={{ width: `${Math.max(3, (f.totalCent / maiorForma) * 100)}%` }}
                    />
                  </span>
                  <span className="font-medium tabular-nums">{emReais(f.totalCent)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13.5px] text-tinta-media">Nenhum pagamento registrado no período.</p>
          )}
          <div className="mt-auto flex items-center justify-between border-t border-linha-suave pt-3 text-[13.5px]">
            <span className="text-tinta-media">Estornos no período</span>
            <span className={`font-medium tabular-nums ${estornos.quantidade ? 'text-reg-falta' : ''}`}>
              {emReais(estornos.totalCent)}
            </span>
          </div>
        </section>

        <section className={`${cartao} grid grid-cols-2 gap-px overflow-hidden bg-linha-suave p-0`}>
          {([
            ['Clientes ativos', String(gente.ativos), `${gente.inativos} inativos`],
            ['Novos no período', String(gente.novos), null],
            ['Contratos em vigor', String(cart.emVigor), `${cart.novos} novos, ${cart.encerrados} encerrados`],
            ['Recibos emitidos', String(recibos.emitidos),
              recibos.emitidos ? emReais(recibos.emitidoCent) : null],
          ] as const).map(([rotulo, valor, nota]) => (
            <div key={rotulo} className="flex flex-col gap-1.5 bg-superficie p-4">
              <span className="text-[13.5px] text-tinta-media">{rotulo}</span>
              <span className="font-titulo text-[24px] leading-none font-semibold tabular-nums">{valor}</span>
              {nota ? <span className="text-[12px] text-tinta-fraca">{nota}</span> : null}
            </div>
          ))}
        </section>
      </div>

      <div className="grid items-start gap-3 xl:grid-cols-2">
        <section className={`${cartao} p-4`}>
          <div className="flex items-baseline justify-between gap-3 pb-3">
            <h2 className="font-titulo text-[18px] font-semibold">Em atraso hoje</h2>
            {atraso.length ? (
              <span className="text-[14.5px] font-semibold text-reg-falta tabular-nums">
                {emReais(vencidoTotal)}
              </span>
            ) : null}
          </div>
          {atraso.length === 0 ? (
            <Vazio
              icone="dinheiro"
              desenho="tudo-certo"
              titulo="Ninguém em atraso"
              texto="Nenhuma cobrança vencida sem pagamento."
            />
          ) : (
            <ul className="flex flex-col">
              {atraso.map((a) => (
                <li
                  key={a.pessoaId}
                  className="flex items-center gap-3 border-b border-linha-suave py-2.5 last:border-0"
                >
                  <Avatar nome={a.pessoaNome} tamanho={32} decorativo />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <Link
                      href={`/pessoas/${a.pessoaId}?aba=contratos`}
                      className="truncate text-[14.5px] font-medium hover:underline"
                    >
                      {a.pessoaNome}
                    </Link>
                    <span className="text-[12px] text-tinta-media">
                      {a.cobrancas} {a.cobrancas === 1 ? 'cobrança' : 'cobranças'}
                    </span>
                  </span>
                  <span className="rounded-full bg-alerta-fundo px-2 py-0.5 text-[12px] font-medium whitespace-nowrap text-alerta">
                    {a.diasDoMaisVelho} {a.diasDoMaisVelho === 1 ? 'dia' : 'dias'}
                  </span>
                  <span className="w-[92px] text-right text-[14.5px] font-semibold tabular-nums">
                    {emReais(a.totalCent)}
                  </span>
                  {a.telefone ? (
                    <a
                      href={`tel:${a.telefone.replace(/\D/g, '')}`}
                      className="inline-flex min-h-9 w-16 items-center justify-center rounded-media border border-linha bg-superficie text-[13.5px] font-medium hover:bg-superficie-mais-suave"
                    >
                      Ligar
                    </a>
                  ) : <span className="w-16" />}
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex flex-col gap-3">
          <section className={`${cartao} p-4`}>
            <h2 className="pb-3 font-titulo text-[18px] font-semibold">
              Faturamento por modalidade
            </h2>
            <Barras itens={porServico} />
            {porPlano.length > 1 ? (
              <>
                <h3 className="pt-4 pb-2 text-[13.5px] font-medium text-tinta-media">
                  Por plano
                </h3>
                <Barras itens={porPlano} />
              </>
            ) : null}
          </section>

          <section className={`${cartao} p-4`}>
            <h2 className="pb-3 font-titulo text-[18px] font-semibold">Previsão</h2>
            <dl className="flex flex-col gap-2 text-[13.5px]">
              <Linha termo="Mensalidades em vigor" valor={emReais(cart.recorrenteCent)} />
              <Linha termo="Ainda vence este mês" valor={emReais(receber.aVencerCent)} />
              <Linha termo="Vencido sem pagamento" valor={emReais(vencido.vencidoCent)} />
              <Linha termo="Previsto para o próximo mês" valor={emReais(material.previstoCent)} />
              {vinculo.contratos > 0 ? (
                <Linha
                  termo={`Desconto por segunda modalidade (${vinculo.contratos})`}
                  valor={emReais(vinculo.totalCent)}
                />
              ) : null}
            </dl>
          </section>

          {estornos.quantidade > 0 ? (
            <section className={`${cartao} p-4`}>
              <h2 className="pb-3 font-titulo text-[18px] font-semibold">Estornos</h2>
              <ul className="flex flex-col gap-2">
                {estornos.linhas.map((e, i) => (
                  <li
                    key={`${e.estornadoEm}-${i}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-linha-suave pb-2 text-[13.5px] last:border-0"
                  >
                    <span className="flex-1">{e.pessoaNome}</span>
                    <span className="text-tinta-media">
                      {dataCurta(e.estornadoEm.slice(0, 10))} · {e.motivo}
                    </span>
                    <span className="tabular-nums">{emReais(e.valorCent)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function Linha({ termo, valor }: { termo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-tinta-media">{termo}</dt>
      <dd className="shrink-0">{valor}</dd>
    </div>
  )
}

/** A barra existe para comparar de relance; o número continua escrito ao lado. */
function Barras({ itens }: { itens: Array<{ nome: string; totalCent: number }> }) {
  const maior = Math.max(1, ...itens.map((i) => i.totalCent))
  if (itens.length === 0) {
    return <p className="text-[13.5px] text-tinta-media">Nada recebido no período.</p>
  }
  return (
    <ul className="flex flex-col gap-2">
      {itens.map((i) => (
        <li key={i.nome} className="flex items-center gap-3">
          <span className="w-[38%] truncate text-[13.5px]">{i.nome}</span>
          <span className="h-2 flex-1 rounded-peca bg-superficie-mais-suave">
            <span
              className="block h-2 rounded-peca bg-marca"
              style={{ width: `${Math.round((i.totalCent / maior) * 100)}%` }}
            />
          </span>
          <span className="text-[13.5px]">{emReais(i.totalCent)}</span>
        </li>
      ))}
    </ul>
  )
}
