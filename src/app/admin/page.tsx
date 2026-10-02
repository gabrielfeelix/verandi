import { redirect } from 'next/navigation'

/** `/admin` é a porta; a primeira tela é a visão geral. */
export default function Admin() {
  redirect('/admin/visao-geral')
}
