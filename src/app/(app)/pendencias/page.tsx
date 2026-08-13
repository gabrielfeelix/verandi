import { redirect } from 'next/navigation'
import { clienteServidor, exigirConta } from '@/server/conta'
import { listarPendencias } from '@/server/pendencias/consultas'
import { ProvedorDeAviso } from '@/components/ui/desfazer'
import { ListaPendencias } from '@/components/pendencias/lista'

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
  const grupos = await listarPendencias(db, conta.contaId, conta.fuso)
  const total = grupos.reduce((n, g) => n + g.itens.length, 0)

  return (
    <ProvedorDeAviso>
      <div className="flex max-w-4xl flex-col gap-5">
        <header className="flex flex-col gap-1">
          <h1 className="font-titulo text-[30px] font-semibold tracking-[-.02em]">
            Pendências
          </h1>
          <p className="text-tinta-media">
            {total === 0
              ? 'Nada esperando por você.'
              : `${total} coisa(s) esperando decisão.`}
          </p>
        </header>

        <ListaPendencias grupos={grupos} />
      </div>
    </ProvedorDeAviso>
  )
}
