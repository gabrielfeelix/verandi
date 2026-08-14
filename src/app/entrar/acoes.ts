'use server'

import { redirect } from 'next/navigation'
import { clienteServidor, papelAoEntrar } from '@/server/conta'
import { destinoDoPapel } from '@/core/acesso/destino'

export type EstadoEntrar = { erro: string } | null

export async function entrar(
  _estado: EstadoEntrar,
  form: FormData,
): Promise<EstadoEntrar> {
  const email = String(form.get('email') ?? '')
  const senha = String(form.get('senha') ?? '')

  const db = await clienteServidor()
  const { data, error } = await db.auth.signInWithPassword({ email, password: senha })

  // mensagem única de propósito: dizer "esse e-mail não existe" entrega a
  // quem está tentando adivinhar quais e-mails estão cadastrados
  if (error || !data.user) return { erro: 'E-mail ou senha não conferem.' }

  // O destino sai daqui, não da raiz: passar por `/` custava um redirecionamento
  // inteiro a mais numa ação que a pessoa espera olhando para a tela parada.
  // Sem vínculo ativo, a raiz é quem sabe o que fazer.
  const papel = await papelAoEntrar(db, data.user.id)
  redirect(papel ? destinoDoPapel(papel) : '/')
}
