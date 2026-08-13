import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function proxy(req: NextRequest) {
  const res = NextResponse.next({ request: req })

  const db = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cs) =>
          cs.forEach(({ name, value, options }) => res.cookies.set(name, value, options)),
      },
    },
  )

  // renova a sessão a cada pedido; sem isto o Server Component vê token velho
  const { data: { user } } = await db.auth.getUser()

  const publica =
    req.nextUrl.pathname.startsWith('/entrar') ||
    req.nextUrl.pathname.startsWith('/convite') ||
    // a amostra dos primitivos não lê dado de conta nenhuma: é design system
    req.nextUrl.pathname.startsWith('/amostra')

  if (!user && !publica) {
    return NextResponse.redirect(new URL('/entrar', req.url))
  }
  return res
}

/*
 * Arquivo estático não passa por aqui.
 *
 * A lista de extensões precisa cobrir o que o produto realmente serve: enquanto
 * `webp` faltava, a arte das telas de acesso batia no proxy, pagava uma ida ao
 * Supabase e voltava 307 para `/entrar` — quem não está logado, que é justamente
 * quem vê a tela de entrar, nunca via a ilustração.
 */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|avif|ico)$).*)',
  ],
}
