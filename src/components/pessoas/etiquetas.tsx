'use client'

import { useRouter } from 'next/navigation'

/**
 * As etiquetas da conta num seletor, e não numa fila de chips.
 *
 * São livres por conta e crescem com o uso: com oito etiquetas, os chips
 * empurravam os filtros que importam para a segunda linha. O endereço de cada
 * opção vem pronto do servidor, com a busca e os filtros que já estão ligados.
 */
export function SeletorDeEtiqueta({
  opcoes, atual, limpar,
}: {
  opcoes: Array<{ tag: string; n: number; href: string }>
  atual: string | undefined
  /** o endereço sem etiqueta nenhuma */
  limpar: string
}) {
  const router = useRouter()
  if (opcoes.length === 0) return null
  return (
    <select
      aria-label="Etiqueta"
      value={atual ?? ''}
      onChange={(e) => {
        const o = opcoes.find((x) => x.tag === e.target.value)
        router.push(o ? o.href : limpar)
      }}
      className={`min-h-9 cursor-pointer rounded-full border px-3 text-[14.5px] ${
        atual
          ? 'border-escuro bg-escuro font-medium text-tinta-clara'
          : 'border-linha bg-superficie text-tinta-media hover:bg-superficie-mais-suave'
      }`}
    >
      <option value="">Etiqueta</option>
      {opcoes.map((o) => (
        <option key={o.tag} value={o.tag}>{o.tag} ({o.n})</option>
      ))}
    </select>
  )
}
