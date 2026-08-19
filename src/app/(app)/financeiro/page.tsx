import Link from 'next/link'
import { redirect } from 'next/navigation'
import { clienteServidor, exigirConta } from '@/server/conta'
import { hojeEm } from '@/server/agenda/fuso'
import { materializarCobrancas } from '@/server/financeiro/materializar'
import {
  contarAtrasadas, listarCobrancas, materialDoFechamento, POR_PAGINA,
  type FiltroCobranca,
} from '@/server/financeiro/consultas'
import {
  aReceber, carteira, clientes, descontoDeVinculo, emAtraso, estornosDoPeriodo,
  faturamentoPor, recebidoPorForma,
} from '@/core/financeiro/fechamento'
import { competenciaDe, competenciaPorExtenso } from '@/core/financeiro/cobranca'
import { recibosDoPeriodo } from '@/server/recibo/consultas'
import { emReais } from '@/core/planos/plano'
import { dataCurta, somarDias } from '@/core/agenda/datas'
import { ListaDeCobrancas } from '@/components/financeiro/lista'
import { ProvedorDeAviso } from '@/components/ui/desfazer'
import { BuscaDeCobranca } from '@/components/financeiro/busca'
import { Paginacao, Vazio, cartao } from '@/components/ui/pecas'

/**
 * O caixa da recepção.
 *
 * A tela **abre no que precisa de decisão**, e não no extrato do mês: em atraso
 * primeiro, com quantos dias e o telefone à mão. Quem usa está entre um aluno e
 * outro, com o telefone tocando, e a pergunta dela nunca é "quanto faturamos em
 * outubro". O fechamento é a última aba, e é onde essa pergunta mora.
 */

const ABAS: Array<{ id: FiltroCobranca | 'fechamento'; rotulo: string }> = [
  { id: 'atrasadas', rotulo: 'Em atraso' },
  { id: 'a_vencer', rotulo: 'A vencer' },
  { id: 'pagas', rotulo: 'Recebidas' },
  { id: 'canceladas', rotulo: 'Canceladas' },
  { id: 'fechamento', rotulo: 'Fechamento' },
]

type Busca = Promise<{ aba?: string; q?: string; p?: string; de?: string; ate?: string }>

export default async function Financeiro({ searchParams }: { searchParams: Busca }) {
  const conta = await exigirConta()
  // dinheiro é do dono e da recepção; quem atende cai onde ele trabalha
  if (conta.papel === 'profissional') redirect('/hoje')

  const { aba: abaBruta, q, p, de: deBruto, ate: ateBruto } = await searchParams
  const db = await clienteServidor()
  const hoje = hojeEm(conta.fuso)

  /*
   * As cobranças do período nascem aqui, na abertura da tela, como as sessões
   * da semana nascem ao abrir a agenda. Sem cron no plano gratuito, este é o
   * gatilho, e ele é idempotente: no dia 12 de um mês já materializado não há
   * nada a criar, que é o caso da esmagadora maioria das aberturas.
   */
  await materializarCobrancas(db, conta.contaId, hoje)

  const aba = (ABAS.find((a) => a.id === abaBruta)?.id ?? 'atrasadas')
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

  const { linhas, total } = await listarCobrancas(db, conta.contaId, hoje, {
    filtro: aba, busca: q, pagina,
  })

  const endereco = (mudanca: (b: URLSearchParams) => void) => {
    const base = new URLSearchParams()
    base.set('aba', aba)
    if (q) base.set('q', q)
    mudanca(base)
    return `/financeiro?${base}`
  }

  return (
    <ProvedorDeAviso>
      <div className="flex flex-col gap-4">
        <Cabecalho atrasadas={atrasadas} hoje={hoje} />
        <Trilha aba={aba} q={q} atrasadas={atrasadas} />

        <div className={`${cartao} flex flex-col gap-3 p-4`}>
          <BuscaDeCobranca valorInicial={q ?? ''} aba={aba} />

          <ListaDeCobrancas
            linhas={linhas}
            vazio={VAZIO[aba]}
          />

          {total > POR_PAGINA ? (
            <Paginacao
              pagina={pagina} total={total} porPagina={POR_PAGINA}
              hrefDe={(n) => endereco((b) => b.set('p', String(n)))}
            />
          ) : null}
        </div>
      </div>
    </ProvedorDeAviso>
  )
}

const VAZIO: Record<FiltroCobranca, { titulo: string; texto: string }> = {
  atrasadas: {
    titulo: 'Ninguém em atraso',
    texto: 'Toda cobrança vencida está paga. É o estado que esta tela existe para manter, e não é falha de carregamento.',
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
        <h1 className="font-titulo text-[30px] leading-[1.05] font-semibold tracking-[-.02em]">
          Financeiro
        </h1>
        <p className="pt-[3px] text-[13.5px] text-tinta-media">
          {atrasadas === 0
            ? `Nada em atraso hoje, ${dataCurta(hoje)}.`
            : `${atrasadas} ${atrasadas === 1 ? 'cobrança em atraso' : 'cobranças em atraso'} · o objetivo é zerar`}
        </p>
      </div>
      <a
        href="/financeiro/exportar"
        download
        className="inline-flex min-h-11 items-center rounded-padrao border border-linha bg-superficie px-3.5 text-[13px] font-medium hover:bg-superficie-mais-suave"
      >
        Exportar
      </a>
    </header>
  )
}

function Trilha({
  aba, q, atrasadas,
}: {
  aba: string
  q?: string
  atrasadas: number
}) {
  return (
    <nav
      aria-label="O que mostrar"
      className="inline-flex max-w-full gap-[3px] overflow-x-auto rounded-media border border-linha bg-superficie p-1"
    >
      {ABAS.map((a) => {
        const ligado = a.id === aba
        const busca = new URLSearchParams({ aba: a.id })
        if (q) busca.set('q', q)
        return (
          <Link
            key={a.id}
            href={`/financeiro?${busca}`}
            aria-current={ligado ? 'page' : undefined}
            className={`inline-flex min-h-10 items-center gap-2 rounded-padrao px-3.5 text-[13px] whitespace-nowrap ${
              ligado
                ? 'bg-escuro text-tinta-clara'
                : 'text-tinta-media hover:bg-superficie-mais-suave'
            }`}
          >
            {a.rotulo}
            {a.id === 'atrasadas' && atrasadas > 0 ? (
              <span
                className={`rounded-peca px-1.5 text-[11px] ${
                  ligado ? 'bg-white/15' : 'bg-alerta-fundo text-alerta'
                }`}
              >
                {atrasadas}
              </span>
            ) : null}
          </Link>
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
      className={`inline-flex min-h-9 items-center rounded-peca border px-3 text-[12.5px] ${
        de === novoDe && ate === novoAte
          ? 'border-marca bg-positivo-superficie text-marca'
          : 'border-linha-suave bg-superficie text-tinta-media hover:bg-superficie-mais-suave'
      }`}
    >
      {rotulo}
    </Link>
  )

  return (
    <div className="flex flex-col gap-4">
      <Cabecalho atrasadas={atrasadas} hoje={hoje} />
      <Trilha aba="fechamento" atrasadas={atrasadas} />

      <div className="flex flex-wrap items-center gap-2">
        {/* dia, semana, mês e ano são as quatro janelas que o documento pede */}
        {periodo('Hoje', hoje, hoje)}
        {periodo('Esta semana', somarDias(hoje, -6), hoje)}
        {periodo('Este mês', competenciaDe(hoje), hoje)}
        {periodo('Este ano', `${hoje.slice(0, 4)}-01-01`, hoje)}
        <span className="text-[12px] text-tinta-fraca">
          de {dataCurta(de)} a {dataCurta(ate)}
        </span>
        <a
          href={`/financeiro/exportar?de=${de}&ate=${ate}`}
          download
          className="ml-auto inline-flex min-h-9 items-center rounded-peca border border-linha-suave bg-superficie px-3 text-[12.5px] hover:bg-superficie-mais-suave"
        >
          Planilha
        </a>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Numero
          titulo="Entrou no período"
          valor={emReais(recebido.totalCent)}
          nota={recebido.porForma.length
            ? recebido.porForma.map((f) => `${f.rotulo}: ${emReais(f.totalCent)}`).join(' · ')
            : 'nenhum pagamento registrado'}
        />
        <Numero
          titulo="Estornos no período"
          valor={emReais(estornos.totalCent)}
          nota={estornos.quantidade === 0
            ? 'nenhum pagamento voltou atrás'
            : `${estornos.quantidade} ${estornos.quantidade === 1 ? 'pagamento devolvido' : 'pagamentos devolvidos'}`}
        />
        <Numero
          titulo="Clientes ativos"
          valor={String(gente.ativos)}
          nota={`${gente.inativos} ${gente.inativos === 1 ? 'inativo' : 'inativos'}, que não somem e ficam fora do padrão`}
        />
        <Numero
          titulo="Novos no período"
          valor={String(gente.novos)}
          nota={`cadastrados entre ${dataCurta(de)} e ${dataCurta(ate)}`}
        />
        <Numero
          titulo="Recibos emitidos"
          valor={String(recibos.emitidos)}
          nota={recibos.cancelados === 0
            ? `${emReais(recibos.emitidoCent)} em papel, nenhum cancelado`
            : `${recibos.cancelados} ${recibos.cancelados === 1 ? 'cancelado' : 'cancelados'}, somando ${emReais(recibos.canceladoCent)}`}
        />
      </div>

      <div className="grid items-start gap-3 xl:grid-cols-2">
        <section className={`${cartao} p-4`}>
          <h2 className="pb-1 font-titulo text-[17px] font-semibold">Quem está em atraso</h2>
          <p className="pb-3 text-[12.5px] text-tinta-media">
            hoje, e não só no período: do mais velho para o mais novo, que é a
            ordem em que se liga
          </p>
          {atraso.length === 0 ? (
            <Vazio
              icone="dinheiro"
              titulo="Ninguém em atraso"
              texto="Nenhuma cobrança vencida sem pagamento."
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {atraso.map((a) => (
                <li
                  key={a.pessoaId}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-linha-suave pb-2 last:border-0"
                >
                  <Link
                    href={`/pessoas/${a.pessoaId}?aba=contratos`}
                    className="flex-1 text-[13px] hover:underline"
                  >
                    {a.pessoaNome}
                  </Link>
                  <span className="text-[12px] text-tinta-media">
                    {a.cobrancas} {a.cobrancas === 1 ? 'cobrança' : 'cobranças'} ·{' '}
                    {a.diasDoMaisVelho} dias
                  </span>
                  <span className="font-mono text-[13px]">{emReais(a.totalCent)}</span>
                  {a.telefone ? (
                    <a
                      href={`tel:${a.telefone.replace(/\D/g, '')}`}
                      className="text-[12px] text-marca underline"
                    >
                      ligar
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex flex-col gap-3">
          <section className={`${cartao} p-4`}>
            <h2 className="pb-1 font-titulo text-[17px] font-semibold">
              Quanto cada modalidade faturou
            </h2>
            <p className="pb-3 text-[12.5px] text-tinta-media">
              sobre o que entrou, e não sobre o que foi cobrado
            </p>
            <Barras itens={porServico} />
            {porPlano.length > 1 ? (
              <>
                <h3 className="pt-4 pb-2 text-[10.5px] font-semibold tracking-[.1em] text-tinta-fraca uppercase">
                  Por plano
                </h3>
                <Barras itens={porPlano} />
              </>
            ) : null}
          </section>

          <section className={`${cartao} p-4`}>
            <h2 className="pb-3 font-titulo text-[17px] font-semibold">A carteira</h2>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Par termo="Contratos novos" valor={String(cart.novos)} />
              <Par termo="Encerrados" valor={String(cart.encerrados)} />
              <Par termo="Em vigor hoje" valor={String(cart.emVigor)} />
              <Par termo="Recorrente" valor={emReais(cart.recorrenteCent)} />
            </dl>
            <p className="pt-3 text-[12px] text-tinta-media">
              Recorrente é a soma dos contratos em vigor, sem os trancados: quem
              está em licença não paga o período parado. Ainda vai vencer neste
              mês: {emReais(receber.aVencerCent)}, e vencido e não pago hoje:{' '}
              {emReais(vencido.vencidoCent)}. O mês seguinte deve gerar{' '}
              {emReais(material.previstoCent)}, e o preço de vínculo custa{' '}
              {emReais(vinculo.totalCent)} em {vinculo.contratos}{' '}
              {vinculo.contratos === 1 ? 'contrato' : 'contratos'}.
            </p>
          </section>

          {estornos.quantidade > 0 ? (
            <section className={`${cartao} p-4`}>
              <h2 className="pb-1 font-titulo text-[17px] font-semibold">
                O que voltou atrás
              </h2>
              <p className="pb-3 text-[12.5px] text-tinta-media">
                estornos do período, com o motivo que quem estornou escreveu
              </p>
              <ul className="flex flex-col gap-2">
                {estornos.linhas.map((e, i) => (
                  <li
                    key={`${e.estornadoEm}-${i}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-linha-suave pb-2 text-[12.5px] last:border-0"
                  >
                    <span className="flex-1">{e.pessoaNome}</span>
                    <span className="text-tinta-media">
                      {dataCurta(e.estornadoEm.slice(0, 10))} · {e.motivo}
                    </span>
                    <span className="font-mono">{emReais(e.valorCent)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>

      <p className="text-[12px] text-tinta-fraca">
        Período de {competenciaPorExtenso(competenciaDe(de))}, de {dataCurta(de)} a{' '}
        {dataCurta(ate)}.
      </p>
    </div>
  )
}

function Numero({ titulo, valor, nota }: { titulo: string; valor: string; nota: string }) {
  return (
    <section className={`${cartao} flex flex-col gap-1 p-4`}>
      <h2 className="text-[10.5px] font-semibold tracking-[.1em] text-tinta-fraca uppercase">
        {titulo}
      </h2>
      <p className="font-titulo text-[26px] leading-none font-semibold">{valor}</p>
      <p className="text-[12px] text-tinta-media">{nota}</p>
    </section>
  )
}

function Par({ termo, valor }: { termo: string; valor: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[11.5px] text-tinta-media">{termo}</dt>
      <dd className="font-titulo text-[19px] font-semibold">{valor}</dd>
    </div>
  )
}

/** A barra existe para comparar de relance; o número continua escrito ao lado. */
function Barras({ itens }: { itens: Array<{ nome: string; totalCent: number }> }) {
  const maior = Math.max(1, ...itens.map((i) => i.totalCent))
  if (itens.length === 0) {
    return <p className="text-[12.5px] text-tinta-media">Nada recebido no período.</p>
  }
  return (
    <ul className="flex flex-col gap-2">
      {itens.map((i) => (
        <li key={i.nome} className="flex items-center gap-3">
          <span className="w-[38%] truncate text-[12.5px]">{i.nome}</span>
          <span className="h-2 flex-1 rounded-peca bg-superficie-mais-suave">
            <span
              className="block h-2 rounded-peca bg-marca"
              style={{ width: `${Math.round((i.totalCent / maior) * 100)}%` }}
            />
          </span>
          <span className="font-mono text-[12.5px]">{emReais(i.totalCent)}</span>
        </li>
      ))}
    </ul>
  )
}
