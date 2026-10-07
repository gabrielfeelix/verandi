import Link from 'next/link'
import { OPERA, clienteServidor, exigirPapel } from '@/server/conta'
import { SecoesDoFinanceiro } from '@/components/financeiro/secoes'
import { emitenteDaConta } from '@/server/config/consultas'
import {
  listarRecibos, POR_PAGINA, resumoDosRecibos, TETO_DO_RESUMO_RECIBO,
  emailsDosPagadores, ultimosEnvios, type FiltroRecibo,
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
import { Chip, Nota, Paginacao, cartao } from '@/components/ui/pecas'
import { AreaQueTroca } from '@/components/ui/troca'
import Carregando from './loading'

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
  aba?: string; q?: string; p?: string; de?: string; ate?: string; datas?: string
}>

export default async function Recibos({ searchParams }: { searchParams: Busca }) {
  const conta = await exigirPapel(OPERA, 'Recibos')

  const { aba: abaBruta, q, p, de, ate, datas } = await searchParams
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

  // conta que nunca emitiu: cartões zerados, filtros e busca em cima de uma
  // lista vazia só davam trabalho de ler. Fica o aviso de onde o recibo nasce
  const nenhumAinda = !q && aba === 'todos' && !de && !ate

  const [{ linhas, total }, { resumo, completo }, emitente] = await Promise.all([
    listarRecibos(db, conta.contaId, {
      filtro: aba, busca: q, pagina, periodo, fuso: conta.fuso,
    }),
    resumoDosRecibos(db, conta.contaId, {
      filtro: aba, busca: q, periodo, fuso: conta.fuso,
    }),
    emitenteDaConta(db, conta.contaId),
  ])

  const nenhumAindaVazio = nenhumAinda && total === 0

  const [envios, emails] = await Promise.all([
    ultimosEnvios(db, conta.contaId, linhas.map((l) => l.id)),
    emailsDosPagadores(db, conta.contaId, linhas.map((l) => l.pessoaId)),
  ])

  const endereco = (n: number) => {
    const b = new URLSearchParams({ aba })
    if (q) b.set('q', q)
    if (periodo) { b.set('de', periodo.de); b.set('ate', periodo.ate) }
    b.set('p', String(n))
    return `/recibos?${b}`
  }

  const recorte = periodoPorExtenso(periodo)

  return (
    <AreaQueTroca esqueleto={<Carregando />}>
    <ProvedorDeAviso>
      <div className="flex flex-col gap-4">
        <header>
          <h1 className="font-titulo text-[28px] leading-[1.05] font-semibold tracking-[-.02em]">
            Financeiro
          </h1>
          <p className="pt-[3px] text-[14.5px] text-tinta-media">
            {/* o singular carrega o particípio junto: "1 recibo emitidos" era
                o que saía quando só o substantivo variava */}
            {total === 0
              ? recorte
                ? `Nenhum recibo ${recorte}.`
                : 'Nenhum recibo emitido ainda.'
              : recorte
                ? `${total} ${total === 1 ? 'recibo' : 'recibos'} ${recorte}.`
                : `${total} ${total === 1 ? 'recibo emitido' : 'recibos emitidos'}.`}
          </p>
        </header>
        <SecoesDoFinanceiro ativa="recibos" />

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

        {nenhumAindaVazio ? null : (
        <>
        {/* chips, como a situação em Cobranças: as abas de cima são as seções */}
        <nav aria-label="O que mostrar" className="flex flex-wrap gap-1.5">
          {ABAS.map((a) => {
            const ligado = a.id === aba
            const b = new URLSearchParams({ aba: a.id })
            if (q) b.set('q', q)
            // o período atravessa a troca de aba: quem filtrou janeiro e clicou
            // em "Cancelados" quer os cancelados de janeiro
            if (periodo) { b.set('de', periodo.de); b.set('ate', periodo.ate) }
            return (
              <Chip key={a.id} href={`/recibos?${b}`} ativo={ligado}>
                {a.rotulo}
              </Chip>
            )
          })}
        </nav>

        {/* a faixa compacta da Cobranças: quatro cartões empilhados empurravam a
            lista para a segunda tela no celular */}
        <FaixaDeNumeros
          compacta
          itens={[
            {
              rotulo: 'Comprovado',
              valor: emReais(resumo.validoCent),
              tom: 'positivo',
              nota: `${resumo.validos} ${resumo.validos === 1 ? 'recibo válido' : 'recibos válidos'}`,
            },
            {
              rotulo: 'Emitidos',
              valor: String(resumo.quantidade),
              nota: recorte ?? 'desde o primeiro',
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
              nota: 'trocados por uma versão nova',
            },
          ]}
          aviso={completo ? null
            : `A soma cobre os primeiros ${TETO_DO_RESUMO_RECIBO.toLocaleString('pt-BR')} recibos deste recorte. Filtre por data para fechar o número.`}
        />

        </>
        )}

        <div className={`${cartao} flex flex-col gap-3 p-4`}>
          {nenhumAindaVazio ? null : (
            <>
              {/* período num menu e a busca ao lado, como na Cobranças */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1"><BuscaDeRecibo valorInicial={q ?? ''} aba={aba} /></div>
                <BarraDePeriodo
                  base="/recibos"
                  periodo={periodo}
                  hoje={hoje}
                  rotulo="Emissão"
                  escondidos={{ aba, q }}
                  abrirDatas={datas === '1'}
                  menu
                />
              </div>
            </>
          )}
          <ListaDeRecibos
            linhas={linhas}
            envios={Object.fromEntries([...envios].map(([id, e]) => [
              id, { para: e.para, em: dataCurta(e.em.slice(0, 10)) },
            ]))}
            emails={Object.fromEntries(emails)}
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
    </AreaQueTroca>
  )
}
