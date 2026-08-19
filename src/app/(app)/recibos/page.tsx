import Link from 'next/link'
import { redirect } from 'next/navigation'
import { clienteServidor, exigirConta } from '@/server/conta'
import { emitenteDaConta } from '@/server/config/consultas'
import {
  listarRecibos, POR_PAGINA, type FiltroRecibo,
} from '@/server/recibo/consultas'
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

type Busca = Promise<{ aba?: string; q?: string; p?: string }>

export default async function Recibos({ searchParams }: { searchParams: Busca }) {
  const conta = await exigirConta()
  if (conta.papel === 'profissional') redirect('/hoje')

  const { aba: abaBruta, q, p } = await searchParams
  const db = await clienteServidor()

  const aba = ABAS.find((a) => a.id === abaBruta)?.id ?? 'todos'
  const pagina = Math.max(1, Number(p) || 1)

  const [{ linhas, total }, emitente] = await Promise.all([
    listarRecibos(db, conta.contaId, { filtro: aba, busca: q, pagina }),
    emitenteDaConta(db, conta.contaId),
  ])

  const endereco = (n: number) => {
    const b = new URLSearchParams({ aba })
    if (q) b.set('q', q)
    b.set('p', String(n))
    return `/recibos?${b}`
  }

  return (
    <ProvedorDeAviso>
      <div className="flex flex-col gap-4">
        <header>
          <h1 className="font-titulo text-[30px] leading-[1.05] font-semibold tracking-[-.02em]">
            Recibos
          </h1>
          <p className="pt-[3px] text-[13.5px] text-tinta-media">
            {total === 0
              ? 'Nenhum recibo emitido ainda.'
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

        <div className={`${cartao} flex flex-col gap-3 p-4`}>
          <BuscaDeRecibo valorInicial={q ?? ''} aba={aba} />
          <ListaDeRecibos linhas={linhas} />
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
