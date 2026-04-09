import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    const { pathname } = request.nextUrl

    // Rota raiz
    if (pathname === '/') {
      if (user) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Rotas públicas
    if (pathname.startsWith('/login')) {
      if (user) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
      return supabaseResponse
    }

    // Rotas protegidas — requer autenticação
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    return supabaseResponse
  } catch {
    // Em caso de erro, redirecionar raiz para login; demais rotas passam
    if (request.nextUrl.pathname === '/') {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return NextResponse.next({ request })
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
