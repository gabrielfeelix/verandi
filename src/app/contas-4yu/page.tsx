import { redirect } from 'next/navigation'

/**
 * Endereço antigo da lista de contas, de antes da área de administração.
 *
 * Fica porque há link guardado, favorito e print com ele. A busca vai junto, e
 * por isso a rota mora fora do `(app)`: o layout de lá manda o suporte para
 * `/admin` antes de esta página rodar, e a busca se perdia no caminho.
 */
export default async function Contas4YU({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; p?: string }>
}) {
  const { q, p } = await searchParams
  const b = new URLSearchParams()
  if (q) b.set('q', q)
  if (p) b.set('p', p)
  const s = b.toString()
  redirect(s ? `/admin/empresas?${s}` : '/admin/empresas')
}
