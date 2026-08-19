import { notFound, redirect } from 'next/navigation'
import { clienteServidor, exigirConta } from '@/server/conta'
import { reciboPorId } from '@/server/recibo/consultas'
import { FolhaDoRecibo } from '@/components/recibo/folha'
import { BotaoImprimir } from '@/components/ui/imprimir'
import { Voltar } from '@/components/ui/voltar'

/**
 * A folha, para ver e imprimir.
 *
 * A segunda via é esta mesma tela: nada é recalculado, então imprimir hoje ou
 * daqui a três anos dá o mesmo papel. O que sai da folha está em `@media
 * print`, no `globals.css`, e o resto da tela some.
 */
export default async function Recibo({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const conta = await exigirConta()
  if (conta.papel === 'profissional') redirect('/hoje')

  const db = await clienteServidor()
  const recibo = await reciboPorId(db, conta.contaId, id)
  if (!recibo) notFound()

  return (
    <div className="flex flex-col gap-4">
      <header
        data-imprimir="fora"
        className="flex flex-wrap items-end justify-between gap-3"
      >
        <div>
          <Voltar rotulo="Recibos" />
          <h1 className="font-titulo text-[30px] leading-[1.05] font-semibold tracking-[-.02em]">
            Recibo
          </h1>
          <p className="pt-[3px] text-[13.5px] text-tinta-media">
            duas vias na mesma folha: uma fica com quem pagou, a outra com o
            estúdio
          </p>
        </div>
        <BotaoImprimir rotulo="Imprimir" />
      </header>

      <FolhaDoRecibo
        serie={recibo.serie}
        numero={recibo.numero}
        versao={recibo.versao}
        status={recibo.status}
        corpo={recibo.corpo}
        motivo={recibo.motivo}
      />
    </div>
  )
}
