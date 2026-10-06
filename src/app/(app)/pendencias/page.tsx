import { OPERA, clienteServidor, exigirPapel } from '@/server/conta'
import { esvaziadasHoje, listarPendencias } from '@/server/pendencias/consultas'
import { ProvedorDeAviso } from '@/components/ui/desfazer'
import { ListaPendencias } from '@/components/pendencias/lista'

/**
 * A primeira tela do dia de quem opera: o que precisa de alguém hoje.
 *
 * Cada grupo é uma coisa que a planilha perde. Reposição em aberto hoje vive na
 * memória de quem escreveu "REP 05/6" numa célula, e some quando essa pessoa
 * entra de férias.
 */
export default async function Pendencias() {
  const conta = await exigirPapel(OPERA, 'Pendências')

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
            <h1 className="font-titulo text-[28px] leading-[1.05] font-semibold tracking-[-.02em]">
              Pendências
            </h1>
            <p className="pt-[3px] text-[14.5px] text-tinta-media">
              {total === 0
                ? 'Nada pendente agora.'
                : `${total} ${total === 1 ? 'item pendente' : 'itens pendentes'}.`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* o número que mostra progresso, e não só dívida */}
            {esvaziadas > 0 ? (
              <span className="text-[13.5px] text-tinta-media">
                {esvaziadas} {esvaziadas === 1 ? 'resolvido' : 'resolvidos'} hoje
              </span>
            ) : null}
            <a
              href="/pendencias/exportar"
              download
              className="inline-flex min-h-11 items-center rounded-padrao border border-linha bg-superficie px-3.5 text-[14.5px] font-medium hover:bg-superficie-mais-suave"
            >
              Exportar
            </a>
          </div>
        </header>

        {/* uma coluna só: o "Resumo" ao lado repetia a contagem que já está no
            título de cada grupo, e a dica do Dispensar mora no próprio modal */}
        <div data-guia="pendencias-lista">
          <ListaPendencias grupos={grupos} />
        </div>
      </div>
    </ProvedorDeAviso>
  )
}
