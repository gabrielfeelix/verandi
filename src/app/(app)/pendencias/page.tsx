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
      <div className="flex flex-col gap-4">
        <header>
          <h1 className="font-titulo text-[30px] leading-[1.05] font-semibold tracking-[-.02em]">
            Pendências
          </h1>
          <p className="pt-[3px] text-[13.5px] text-tinta-media">
            {total === 0
              ? 'Nada exige ação humana agora.'
              : `${total} ${total === 1 ? 'item exige' : 'itens exigem'} ação humana · o objetivo é zerar`}
          </p>
        </header>

        <ListaPendencias grupos={grupos} />
      </div>
    </ProvedorDeAviso>
  )
}
