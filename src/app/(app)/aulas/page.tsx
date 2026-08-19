import Link from 'next/link'
import { redirect } from 'next/navigation'
import { clienteServidor, exigirConta } from '@/server/conta'
import { carregarVocabulario, resolverRotulos } from '@/server/vocabulario'
import { hojeEm } from '@/server/agenda/fuso'
import { aulasDoPeriodo } from '@/server/relatorio/consultas'
import { ressalvaDoTotal } from '@/core/relatorio/aulas'
import { competenciaDe } from '@/core/financeiro/cobranca'
import { dataCurta, somarDias } from '@/core/agenda/datas'
import { Vazio, cartao } from '@/components/ui/pecas'

/**
 * Quantas aulas cada profissional aplicou.
 *
 * O item 7 do documento do cliente, com as três janelas que ele pede: dia,
 * semana e mês. O número grande é a aula que já aconteceu e não foi cancelada,
 * e ao lado dele fica tudo que permite conferir esse número sem acreditar nele:
 * quantas tiveram presença, quantas ficaram sem ninguém, quantas ninguém
 * registrou, e quantas caíram por feriado.
 *
 * É relatório do dono. A recepção não vê, e quem atende muito menos: contar
 * aula de outra pessoa é a porta de uma conversa que não é dela.
 */

type Busca = Promise<{ de?: string; ate?: string }>

export default async function Aulas({ searchParams }: { searchParams: Busca }) {
  const conta = await exigirConta()
  if (conta.papel !== 'dono' && conta.papel !== 'suporte') redirect('/hoje')

  const { de: deBruto, ate: ateBruto } = await searchParams
  const db = await clienteServidor()
  const rotulos = resolverRotulos(await carregarVocabulario(db, conta.contaId))
  const hoje = hojeEm(conta.fuso)

  const de = deBruto || competenciaDe(hoje)
  const ate = ateBruto || hoje

  const r = await aulasDoPeriodo(db, conta.contaId, de, ate, conta.fuso)
  const ressalva = ressalvaDoTotal(r.total)

  const periodo = (rotulo: string, novoDe: string, novoAte: string) => (
    <Link
      key={rotulo}
      href={`/aulas?de=${novoDe}&ate=${novoAte}`}
      className={`inline-flex min-h-9 items-center rounded-peca border px-3 text-[13.5px] ${
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
      <header className="flex flex-wrap items-end justify-between gap-x-5 gap-y-3">
        <div>
          <h1 className="font-titulo text-[30px] leading-[1.05] font-semibold tracking-[-.02em]">
            Aulas por {rotulos.profissional.singular.toLowerCase()}
          </h1>
          <p className="pt-[3px] text-[14.5px] text-tinta-media">
            {r.total.aplicadas === 0
              ? 'Nenhuma aula aconteceu no período escolhido.'
              : `${r.total.aplicadas} ${r.total.aplicadas === 1 ? 'aula aplicada' : 'aulas aplicadas'}, com ${r.total.atendimentos} ${r.total.atendimentos === 1 ? 'presença' : 'presenças'}`}
            {ressalva ? ` · ${ressalva}` : ''}
          </p>
        </div>
        <a
          href={`/aulas/exportar?de=${de}&ate=${ate}`}
          download
          className="inline-flex min-h-11 items-center rounded-padrao border border-linha bg-superficie px-3.5 text-[14px] font-medium hover:bg-superficie-mais-suave"
        >
          Planilha
        </a>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {/* dia, semana e mês são as três janelas que o documento pede */}
        {periodo('Hoje', hoje, hoje)}
        {periodo('Esta semana', somarDias(hoje, -6), hoje)}
        {periodo('Este mês', competenciaDe(hoje), hoje)}
        {periodo('Este ano', `${hoje.slice(0, 4)}-01-01`, hoje)}
        <span className="text-[13px] text-tinta-fraca">
          de {dataCurta(de)} a {dataCurta(ate)}
        </span>
      </div>

      <div className={`${cartao} overflow-hidden`}>
        {r.linhas.length === 0 ? (
          <Vazio
            icone="pessoas"
            titulo="Nada para contar neste período"
            texto="As aulas aparecem aqui depois de acontecerem. Se você esperava alguma, confira se a grade cobre esses dias, na Grade fixa."
          />
        ) : (
          <>
            {/* rolagem própria: sete colunas não cabem num celular, e quem rola
                é a tabela, nunca a página */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse">
                <thead>
                  <tr className="border-b border-linha-fina text-left">
                    <Cabeca>{rotulos.profissional.singular}</Cabeca>
                    <Cabeca numero>Aulas</Cabeca>
                    <Cabeca numero>Presenças</Cabeca>
                    <Cabeca numero>Com gente</Cabeca>
                    <Cabeca numero>Sem ninguém</Cabeca>
                    <Cabeca numero>Sem chamada</Cabeca>
                    <Cabeca numero>Canceladas</Cabeca>
                    <Cabeca numero>Por dar</Cabeca>
                  </tr>
                </thead>
                <tbody>
                  {r.linhas.map((l) => (
                    <tr
                      key={l.profissionalId ?? 'sem'}
                      className="border-b border-linha-fina last:border-b-0 hover:bg-superficie-tenue"
                    >
                      <td className="px-5 py-3.5 text-[14.5px]">
                        {l.profissionalNome}
                      </td>
                      <Celula forte>{l.aplicadas}</Celula>
                      <Celula>{l.atendimentos}</Celula>
                      <Celula>{l.comPresenca}</Celula>
                      <Celula apagado={l.semNinguem === 0}>{l.semNinguem}</Celula>
                      <Celula alerta={l.semChamada > 0}>{l.semChamada}</Celula>
                      <Celula apagado={l.canceladas === 0}>
                        {l.canceladas}
                        {l.porFeriado > 0 ? (
                          <span className="pl-1 text-[12px] text-tinta-media">
                            ({l.porFeriado} fechado{l.porFeriado === 1 ? '' : 's'})
                          </span>
                        ) : null}
                      </Celula>
                      <Celula apagado={l.aindaPorDar === 0}>{l.aindaPorDar}</Celula>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-linha-fina bg-superficie-suave px-5 py-4">
              <p className="text-[13.5px] leading-relaxed text-tinta-media">
                <strong>Aula aplicada</strong> é a que já aconteceu e não foi
                cancelada, mesmo quando ninguém apareceu: quem atende foi ao
                estúdio e esperou. As colunas ao lado existem para você conferir
                esse número, e não para acreditar nele.
                {/* as frases concordam no singular: "As 1 canceladas" é o
                    tipo de erro que aparece justamente no mês tranquilo */}
                {r.total.porFeriado > 0 ? (
                  <>
                    {' '}
                    {r.total.porFeriado === 1
                      ? 'Uma cancelada é dia fechado, feriado ou fechamento do estúdio, e não falta de ninguém.'
                      : `${r.total.porFeriado} canceladas são dia fechado, feriado ou fechamento do estúdio, e não falta de ninguém.`}
                  </>
                ) : null}
                {r.total.semChamada > 0 ? (
                  <>
                    {' '}
                    {r.total.semChamada === 1
                      ? 'Uma delas aconteceu e ninguém registrou quem veio; ela está em Pendências.'
                      : `${r.total.semChamada} delas aconteceram e ninguém registrou quem veio; elas estão em Pendências.`}
                  </>
                ) : null}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Cabeca({ children, numero = false }: { children: React.ReactNode; numero?: boolean }) {
  return (
    <th
      scope="col"
      className={`px-5 py-3 text-[12px] font-semibold tracking-[.1em] text-tinta-fraca uppercase ${
        numero ? 'text-right' : ''
      }`}
    >
      {children}
    </th>
  )
}

function Celula({
  children, forte = false, apagado = false, alerta = false,
}: {
  children: React.ReactNode
  forte?: boolean
  apagado?: boolean
  alerta?: boolean
}) {
  return (
    <td
      className={`px-5 py-3.5 text-right font-mono text-[14px] ${
        forte ? 'font-medium text-tinta' : ''
      } ${apagado ? 'text-tinta-fraca' : ''} ${alerta ? 'text-alerta' : ''}`}
    >
      {children}
    </td>
  )
}
