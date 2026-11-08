import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config'
import { NextResponse } from 'next/server'

const { auth } = NextAuth(authConfig)

const publicRoutes = ['/login', '/forgot-password']

const roleRoutes: Record<string, string[]> = {
  '/admin': ['SUPER_ADMIN'],
  '/settings/company': ['SUPER_ADMIN'],
  '/reports': ['SUPER_ADMIN', 'HR_MANAGER', 'BRANCH_ADMIN'],
  '/employees': ['SUPER_ADMIN', 'HR_MANAGER', 'BRANCH_ADMIN'],
  '/attendance/manage': ['SUPER_ADMIN', 'HR_MANAGER', 'BRANCH_ADMIN'],
}

export default auth((req: any) => {
  const { pathname } = req.nextUrl
  const session = req.auth

  // Cho phép public routes
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    if (session) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
    return NextResponse.next()
  }

  // Chưa đăng nhập → API trả về 401, Web redirect về login
  if (!session) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: 'UNAUTHORIZED', message: 'Vui lòng đăng nhập' },
        { status: 401 }
      )
    }
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Kiểm tra role cho các protected routes
  for (const [route, allowedRoles] of Object.entries(roleRoutes)) {
    if (pathname.startsWith(route)) {
      if (!allowedRoles.includes(session.user?.role)) {
        return NextResponse.redirect(new URL('/unauthorized', req.url))
      }
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth).*)'],
}
