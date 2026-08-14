import { redirect } from 'next/navigation'
import { clienteServidor, exigirConta } from '@/server/conta'
import { esvaziadasHoje, listarPendencias } from '@/server/pendencias/consultas'
import { ProvedorDeAviso } from '@/components/ui/desfazer'
import { ListaPendencias } from '@/components/pendencias/lista'
import { PONTO_GRUPO } from '@/components/pendencias/tintas'
import { cartao } from '@/components/ui/pecas'

/**
 * A primeira tela do dia de quem opera: o que exige ação humana hoje.
 *
 * Cada grupo é uma coisa que a planilha perde. Reposição em aberto hoje vive na
 * memória de quem escreveu "REP 05/6" numa célula — e some quando essa pessoa
 * entra de férias.
 */
export default async function Pendencias() {
  const conta = await exigirConta()
  if (conta.papel === 'profissional') redirect('/hoje')

  const db = await clienteServidor()
  const [grupos, esvaziadas] = await Promise.all([
    listarPendencias(db, conta.contaId, conta.fuso),
    esvaziadasHoje(db, conta.contaId, conta.fuso),
  ])
  const total = grupos.reduce((n, g) => n + g.itens.length, 0)

  return (
    <ProvedorDeAviso>
      <div className="flex flex-col gap-4">
        <header className="flex flex-wrap items-end justify-between gap-x-5 gap-y-3">
          <div>
            <h1 className="font-titulo text-[30px] leading-[1.05] font-semibold tracking-[-.02em]">
              Pendências
            </h1>
            <p className="pt-[3px] text-[13.5px] text-tinta-media">
              {total === 0
                ? 'Nada exige ação humana agora.'
                : `${total} ${total === 1 ? 'item exige' : 'itens exigem'} ação humana · o objetivo é zerar`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* o número que mostra progresso, e não só dívida */}
            <span className="text-[12px] text-tinta-media">
              esvaziado hoje: {esvaziadas}
            </span>
            <a
              href="/pendencias/exportar"
              download
              className="inline-flex min-h-11 items-center rounded-padrao border border-linha bg-superficie px-3.5 text-[13px] font-medium hover:bg-superficie-mais-suave"
            >
              Exportar
            </a>
          </div>
        </header>

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div data-guia="pendencias-lista">
            <ListaPendencias grupos={grupos} />
          </div>

          <div className="flex flex-col gap-3.5">
            {total > 0 ? (
              <section className={`${cartao} p-4`}>
                <h2 className="pb-3 font-titulo text-[17px] font-semibold">Resumo</h2>
                <ul className="flex flex-col gap-2.5">
                  {grupos.map((g) => (
                    <li key={g.tipo} className="flex items-center gap-2.5">
                      <span
                        aria-hidden
                        className={`size-2 shrink-0 rounded-full ${PONTO_GRUPO[g.tipo]}`}
                      />
                      <span className="flex-1 text-[13px]">{g.titulo}</span>
                      <span className="font-mono text-[13px] text-tinta-media">
                        {g.itens.length}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className="rounded-cartao border border-dashed border-linha-tracejada bg-superficie-suave p-4">
              <p className="text-[12.5px] leading-relaxed text-tinta-media">
                Pendência que nunca zera vira ruído. Por isso dispensar pede
                motivo e o item sai da lista.
              </p>
            </section>
          </div>
        </div>
      </div>
    </ProvedorDeAviso>
  )
}
