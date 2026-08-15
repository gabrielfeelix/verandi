'use server'

import { redirect } from 'next/navigation'
import { clienteServidor, papelAoEntrar } from '@/server/conta'
import { destinoDoPapel } from '@/core/acesso/destino'
import { registrarAceite } from '@/server/legal/aceite'

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

  /*
   * O aceite também é registrado aqui, e não só no convite.
   *
   * Duas razões. A primeira é que quem já usava o produto antes de existirem os
   * documentos nunca passou pela tela de convite: sem isto, o único cliente de
   * verdade ficaria para sempre sem registro nenhum. A segunda é a versão nova:
   * quando o texto muda, é a entrada que volta a colher aceite, sem precisar de
   * uma tela a mais no caminho de quem só quer trabalhar.
   *
   * A tela de entrar diz a frase, com os dois links visíveis ao lado do botão.
   * Registrar aceite de documento que a pessoa não tinha como ver seria pior que
   * não registrar nada.
   */
  await registrarAceite({ usuarioId: data.user.id, origem: 'entrada' })

  // O destino sai daqui, não da raiz: passar por `/` custava um redirecionamento
  // inteiro a mais numa ação que a pessoa espera olhando para a tela parada.
  // Sem vínculo ativo, a raiz é quem sabe o que fazer.
  const papel = await papelAoEntrar(db, data.user.id)
  redirect(papel ? destinoDoPapel(papel) : '/')
}
