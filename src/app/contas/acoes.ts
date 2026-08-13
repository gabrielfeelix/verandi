'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { clienteServidor } from '@/server/conta'
import { destinoDoPapel, type Papel } from '@/core/acesso/destino'

export async function escolherConta(form: FormData) {
  const contaId = String(form.get('contaId') ?? '')

  // confere pela RLS que o usuário realmente pertence à conta antes de gravar
  // o cookie — cookie é palpite do navegador, não autorização
  const db = await clienteServidor()
  const { data: { user } } = await db.auth.getUser()
  if (!user) redirect('/entrar')

  const { data } = await db
    .from('usuario_conta')
    .select('papel')
    .eq('usuario_id', user.id)
    .eq('conta_id', contaId)
    .eq('ativo', true)
    .maybeSingle()

  if (!data) redirect('/contas')

  const jar = await cookies()
  jar.set('conta', contaId, { httpOnly: true, sameSite: 'lax', path: '/' })
  redirect(destinoDoPapel(data.papel as Papel))
}

export async function sair() {
  const db = await clienteServidor()
  await db.auth.signOut()
  redirect('/entrar')
}
