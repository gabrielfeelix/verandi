import type { Metadata } from 'next'
import { TelaDocumento } from '@/components/legal/documento'
import { PRIVACIDADE } from '@/core/legal'

export const metadata: Metadata = {
  title: 'Política de privacidade · Verandi',
  description: PRIVACIDADE.resumo,
}

export default function Privacidade() {
  return <TelaDocumento doc={PRIVACIDADE} />
}
