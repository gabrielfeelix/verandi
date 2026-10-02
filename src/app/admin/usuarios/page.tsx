import { clienteServidor } from '@/server/conta'
import { listarUsuarios } from '@/server/admin/consultas'
import { TabelaDeUsuarios } from '@/components/admin/tabela-de-usuarios'

const POR_PAGINA = 20

/**
 * Todo mundo que entra na Verandi, de qualquer conta.
 *
 * É a tela que faltava: até 02/out/2026, trocar a senha de alguém, dar acesso
 * de admin ou descobrir em que conta uma pessoa trabalha era SQL direto no
 * banco de produção. Busca, filtro e página vivem na URL.
 */
export default async function Usuarios({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; f?: string; p?: string }>
}) {
  const { q, f, p } = await searchParams
  const db = await clienteServidor()
  const [{ data: { user } }, todos] = await Promise.all([db.auth.getUser(), listarUsuarios()])

  const busca = (q ?? '').trim().toLowerCase()
  const filtro = f === 'admin' || f === 'suspensos' ? f : 'todos'
  const achados = todos.filter((u) =>
    (!busca
      || u.email.toLowerCase().includes(busca)
      || (u.nome ?? '').toLowerCase().includes(busca)
      || u.contas.some((c) => c.contaNome.toLowerCase().includes(busca)))
    && (filtro !== 'admin' || u.admin)
    && (filtro !== 'suspensos' || u.suspensa))

  const pagina = Math.max(1, Number(p) || 1)
  const linhas = achados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)

  return (
    <TabelaDeUsuarios
      usuarios={linhas}
      total={achados.length}
      contagem={{
        todos: todos.length,
        admin: todos.filter((u) => u.admin).length,
        suspensos: todos.filter((u) => u.suspensa).length,
      }}
      eu={user?.id ?? ''}
      busca={q ?? ''}
      filtro={filtro}
      pagina={pagina}
      porPagina={POR_PAGINA}
    />
  )
}
