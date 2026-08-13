import type { Metadata } from 'next'
import { Bricolage_Grotesque, DM_Sans, DM_Mono } from 'next/font/google'
import './globals.css'

/*
 * As três fontes entram por `next/font`, que hospeda junto do aplicativo. O
 * protótipo usa `<link>` para o Google: em produção isso é uma requisição a um
 * terceiro travando a primeira pintura, e um endereço a mais para cair.
 */
const titulo = Bricolage_Grotesque({
  variable: '--fonte-titulo',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
})

const texto = DM_Sans({
  variable: '--fonte-texto',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
})

const mono = DM_Mono({
  variable: '--fonte-mono',
  subsets: ['latin'],
  weight: ['400', '500'],
})

export const metadata: Metadata = {
  title: 'Verandi',
  description: 'A agenda do seu negócio, sem planilha.',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="pt-BR"
      className={`${titulo.variable} ${texto.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  )
}
