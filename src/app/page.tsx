import { redirect } from 'next/navigation'
import { contaAtiva } from '@/server/conta'
import { destinoDoPapel } from '@/core/acesso/destino'

export default async function Raiz() {
  const conta = await contaAtiva()
  if (!conta) redirect('/entrar')
  redirect(destinoDoPapel(conta.papel))
}
