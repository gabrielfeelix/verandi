import { listarContas, CONTAS_POR_PAGINA } from '@/server/suporte/consultas'
import { PainelContas } from '@/components/suporte/painel-contas'

/**
 * As contas dos clientes: criar, diagnosticar e entrar.
 *
 * A checagem de admin é do layout de `/admin`. Busca e página vivem na URL:
 * o "conta do Daniel" que alguém achou vira link que se manda no chat.
 */
export default async function Contas({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; p?: string }>
}) {
  const { q, p } = await searchParams
  const pagina = Math.max(1, Number(p) || 1)
  const { linhas, total } = await listarContas({ busca: q, pagina })

  return (
    <PainelContas
      contas={linhas}
      busca={q ?? ''}
      pagina={pagina}
      total={total}
      porPagina={CONTAS_POR_PAGINA}
    />
  )
}
