import Link from 'next/link'
import { redirect } from 'next/navigation'
import { clienteServidor, exigirConta } from '@/server/conta'
import { emitenteDaConta } from '@/server/config/consultas'
import {
  listarRecibos, POR_PAGINA, resumoDosRecibos, TETO_DO_RESUMO_RECIBO,
  ultimosEnvios, type FiltroRecibo,
} from '@/server/recibo/consultas'
import { dataCurta } from '@/core/agenda/datas'
import { hojeEm } from '@/server/agenda/fuso'
import { periodoDaBusca, periodoPorExtenso } from '@/core/financeiro/periodo'
import { emReais } from '@/core/planos/plano'
import { BarraDePeriodo } from '@/components/ui/barra-periodo'
import { FaixaDeNumeros } from '@/components/ui/faixa-numeros'
import { emitenteCompleto } from '@/core/recibo/recibo'
import { ListaDeRecibos } from '@/components/recibo/lista'
import { BuscaDeRecibo } from '@/components/recibo/busca'
import { ProvedorDeAviso } from '@/components/ui/desfazer'
import { Nota, Paginacao, cartao } from '@/components/ui/pecas'

/**
 * O arquivo de recibos: o item 8 do documento, na parte que diz "deverá ser
 * arquivado".
 *
 * O cliente arquiva em pasta de papel porque não tinha onde guardar. O que ele
 * pede não é um arquivo por recibo, é conseguir achar depois: por número, por
 * nome, e com o cancelado visível.
 */

const ABAS: Array<{ id: FiltroRecibo; rotulo: string }> = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'validos', rotulo: 'Válidos' },
  { id: 'cancelados', rotulo: 'Cancelados' },
]

type Busca = Promise<{
  aba?: string; q?: string; p?: string; de?: string; ate?: string
}>

export default async function Recibos({ searchParams }: { searchParams: Busca }) {
  const conta = await exigirConta()
  if (conta.papel === 'profissional') redirect('/hoje')

  const { aba: abaBruta, q, p, de, ate } = await searchParams
  const db = await clienteServidor()
  const hoje = hojeEm(conta.fuso)

  const aba = ABAS.find((a) => a.id === abaBruta)?.id ?? 'todos'
  const pagina = Math.max(1, Number(p) || 1)

  /*
   * A janela é por data de **emissão**, que é o que se procura num arquivo:
   * "os do dia 19 de janeiro" é uma pergunta sobre quando o papel saiu. Sem
   * ela, achar um recibo entre trezentos mil só era possível sabendo o número
   * ou o nome, e quem procura pela data não tem nenhum dos dois.
   */
  const periodo = periodoDaBusca(de, ate)

  const [{ linhas, total }, { resumo, completo }, emitente] = await Promise.all([
    listarRecibos(db, conta.contaId, {
      filtro: aba, busca: q, pagina, periodo, fuso: conta.fuso,
    }),
    resumoDosRecibos(db, conta.contaId, {
      filtro: aba, busca: q, periodo, fuso: conta.fuso,
    }),
    emitenteDaConta(db, conta.contaId),
  ])

  const envios = await ultimosEnvios(db, conta.contaId, linhas.map((l) => l.id))

  const endereco = (n: number) => {
    const b = new URLSearchParams({ aba })
    if (q) b.set('q', q)
    if (periodo) { b.set('de', periodo.de); b.set('ate', periodo.ate) }
    b.set('p', String(n))
    return `/recibos?${b}`
  }

  const recorte = periodoPorExtenso(periodo)

  return (
    <ProvedorDeAviso>
      <div className="flex flex-col gap-4">
        <header>
          <h1 className="font-titulo text-[30px] leading-[1.05] font-semibold tracking-[-.02em]">
            Recibos
          </h1>
          <p className="pt-[3px] text-[13.5px] text-tinta-media">
            {/* o singular carrega o particípio junto: "1 recibo emitidos" era
                o que saía quando só o substantivo variava */}
            {total === 0
              ? recorte
                ? `Nenhum recibo ${recorte}.`
                : 'Nenhum recibo emitido ainda.'
              : recorte
                ? `${total} ${total === 1 ? 'recibo' : 'recibos'} ${recorte}, na série ${emitente.serieRecibo}`
                : `${total} ${total === 1 ? 'recibo emitido' : 'recibos emitidos'}, na série ${emitente.serieRecibo}`}
          </p>
        </header>

        {!emitenteCompleto(emitente) ? (
          <Nota tom="atencao">
            Ninguém consegue emitir recibo enquanto a razão social e o documento
            do estúdio estiverem vazios. Preencha em{' '}
            <Link href="/config?s=recibo" className="underline">
              Configuração, Recibo
            </Link>
            . Recibo sem quem emitiu não comprova nada.
          </Nota>
        ) : null}

        <nav
          aria-label="O que mostrar"
          className="inline-flex max-w-full gap-[3px] overflow-x-auto rounded-media border border-linha bg-superficie p-1"
        >
          {ABAS.map((a) => {
            const ligado = a.id === aba
            const b = new URLSearchParams({ aba: a.id })
            if (q) b.set('q', q)
            // o período atravessa a troca de aba: quem filtrou janeiro e clicou
            // em "Cancelados" quer os cancelados de janeiro
            if (periodo) { b.set('de', periodo.de); b.set('ate', periodo.ate) }
            return (
              <Link
                key={a.id}
                href={`/recibos?${b}`}
                aria-current={ligado ? 'page' : undefined}
                className={`inline-flex min-h-10 items-center rounded-padrao px-3.5 text-[13px] whitespace-nowrap ${
                  ligado
                    ? 'bg-escuro text-tinta-clara'
                    : 'text-tinta-media hover:bg-superficie-mais-suave'
                }`}
              >
                {a.rotulo}
              </Link>
            )
          })}
        </nav>

        <FaixaDeNumeros
          itens={[
            {
              rotulo: 'Comprovado',
              valor: resumo.validoCent > 0 ? emReais(resumo.validoCent) : '—',
              tom: 'positivo',
              nota: `${resumo.validos} ${resumo.validos === 1 ? 'recibo válido' : 'recibos válidos'}`,
            },
            {
              rotulo: 'Emitidos',
              valor: String(resumo.quantidade),
              nota: recorte ?? 'em toda a série',
            },
            {
              rotulo: 'Cancelados',
              valor: String(resumo.cancelados),
              tom: resumo.cancelados > 0 ? 'atencao' : 'neutro',
              nota: 'o número continua ocupado',
            },
            {
              rotulo: 'Corrigidos',
              valor: String(resumo.substituidos),
              nota: 'versões substituídas por outra',
            },
          ]}
          aviso={completo ? null
            : `A soma cobre os primeiros ${TETO_DO_RESUMO_RECIBO.toLocaleString('pt-BR')} recibos deste recorte. Filtre por data para fechar o número.`}
        />

        <div className={`${cartao} flex flex-col gap-3 p-4`}>
          <BarraDePeriodo
            base="/recibos"
            periodo={periodo}
            hoje={hoje}
            rotulo="Emissão"
            escondidos={{ aba, q }}
          />
          <BuscaDeRecibo valorInicial={q ?? ''} aba={aba} />
          <ListaDeRecibos
            linhas={linhas}
            envios={Object.fromEntries([...envios].map(([id, e]) => [
              id, { para: e.para, em: dataCurta(e.em.slice(0, 10)) },
            ]))}
          />
          {total > POR_PAGINA ? (
            <Paginacao
              pagina={pagina} total={total} porPagina={POR_PAGINA}
              hrefDe={endereco}
            />
          ) : null}
        </div>
      </div>
    </ProvedorDeAviso>
  )
}
