'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { clienteServidor } from '@/server/conta'
import { clienteAdmin } from '@/server/supabase'
import { destinoDoPapel, type Papel } from '@/core/acesso/destino'
import { entrarComoSuporte } from '@/server/suporte/acoes'

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

  /*
   * Suporte escolhendo uma empresa de cliente quer entrar nela, não voltar à
   * administração: o mesmo "Entrar" do admin, que registra o acesso antes da
   * primeira tela. Só a conta interna da 4YU leva para `/admin`.
   */
  if (data.papel === 'suporte') {
    const { data: conta } = await clienteAdmin().from('conta').select('interna').eq('id', contaId).maybeSingle()
    if (!conta?.interna) {
      await entrarComoSuporte(contaId)
      redirect('/semana')
    }
  }

  const jar = await cookies()
  jar.set('conta', contaId, { httpOnly: true, sameSite: 'lax', path: '/' })
  redirect(destinoDoPapel(data.papel as Papel))
}

export async function sair() {
  const db = await clienteServidor()
  await db.auth.signOut()
  redirect('/entrar')
}
