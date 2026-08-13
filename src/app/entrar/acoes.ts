'use server'

import { redirect } from 'next/navigation'
import { clienteServidor } from '@/server/conta'

export type EstadoEntrar = { erro: string } | null

export async function entrar(
  _estado: EstadoEntrar,
  form: FormData,
): Promise<EstadoEntrar> {
  const email = String(form.get('email') ?? '')
  const senha = String(form.get('senha') ?? '')

  const db = await clienteServidor()
  const { error } = await db.auth.signInWithPassword({ email, password: senha })

  // mensagem única de propósito: dizer "esse e-mail não existe" entrega a
  // quem está tentando adivinhar quais e-mails estão cadastrados
  if (error) return { erro: 'E-mail ou senha não conferem.' }

  redirect('/')
}
