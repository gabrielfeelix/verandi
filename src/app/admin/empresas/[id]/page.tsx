import { notFound } from 'next/navigation'
import { detalheDaConta, listarLog } from '@/server/admin/consultas'
import { DetalheDaConta } from '@/components/admin/detalhe-da-conta'
import { ListaDoLog } from '@/components/admin/pecas'

/**
 * Uma conta de cliente por inteiro: dados, quem trabalha nela e o que a 4YU
 * fez lá dentro.
 *
 * A aba vive na URL (`?aba=`), como em toda tela do produto: o link que se
 * manda no chat abre onde quem mandou estava olhando.
 */
export default async function Conta({
  params, searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ aba?: string }>
}) {
  const [{ id }, { aba }] = await Promise.all([params, searchParams])
  // id que não é uuid daria erro do banco em vez de "não existe"
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const atual = aba === 'pessoas' || aba === 'log' ? aba : 'dados'
  const [conta, log] = await Promise.all([
    detalheDaConta(id),
    atual === 'log' ? listarLog({ contaId: id, limite: 100 }) : Promise.resolve([]),
  ])
  if (!conta) notFound()

  return (
    <DetalheDaConta conta={conta} aba={atual}>
      {atual === 'log' ? <ListaDoLog eventos={log} semConta /> : null}
    </DetalheDaConta>
  )
}
