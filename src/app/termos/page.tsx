import type { Metadata } from 'next'
import { TelaDocumento } from '@/components/legal/documento'
import { TERMOS } from '@/core/legal'

export const metadata: Metadata = {
  title: 'Termos de uso · Verandi',
  description: TERMOS.resumo,
}

export default function Termos() {
  return <TelaDocumento doc={TERMOS} />
}
