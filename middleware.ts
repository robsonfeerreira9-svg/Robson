import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

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

  // Rota raiz: redireciona conforme status do login
  if (pathname === '/') {
    if (user) {
      // Buscar role
      const { data: usuario } = await supabase
        .from('usuarios')
        .select('role')
        .eq('id', user.id)
        .single()

      const dest = usuario?.role === 'socio' ? '/dashboard' : '/pdv'
      return NextResponse.redirect(new URL(dest, request.url))
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Rotas públicas
  if (pathname.startsWith('/login')) {
    if (user) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return supabaseResponse
  }

  // Rotas protegidas — requer autenticação
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Buscar role para autorização
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = usuario?.role

  // Rotas exclusivas para sócio
  const socioRoutes = ['/dashboard', '/financeiro', '/comissoes', '/produtos', '/estoque']
  const isSocioRoute = socioRoutes.some((r) => pathname.startsWith(r))

  if (isSocioRoute && role !== 'socio') {
    return NextResponse.redirect(new URL('/pdv', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
