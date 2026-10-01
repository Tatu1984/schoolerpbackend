import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { bearerToken, verifyAccessToken } from '@/lib/jwt'

// Endpoints that need no token
const publicRoutes = ['/api/health', '/api/auth/login', '/api/auth/refresh', '/api/mobile/auth/login']

// Students and parents may only call the portal and their own auth endpoints
const portalRoles = ['STUDENT', 'PARENT']
const portalRoutes = ['/api/portal', '/api/auth']

// Routes restricted to specific staff roles (finer checks live in the handlers)
const roleRoutes: Record<string, string[]> = {
  '/api/security': ['SUPER_ADMIN', 'SCHOOL_ADMIN'],
  '/api/roles': ['SUPER_ADMIN', 'SCHOOL_ADMIN'],
}

const matches = (pathname: string, routes: string[]) =>
  routes.some((route) => pathname === route || pathname.startsWith(`${route}/`))

// Browsers calling the API directly must come from an allowed origin.
// Mobile apps and server-to-server calls send no Origin header and are unaffected.
function corsHeaders(request: NextRequest) {
  const origin = request.headers.get('origin')
  const allowed = (process.env.CORS_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean)
  const headers = new Headers()
  if (origin && (allowed.includes('*') || allowed.includes(origin))) {
    headers.set('Access-Control-Allow-Origin', origin)
    headers.set('Vary', 'Origin')
    headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
    headers.set('Access-Control-Allow-Headers', 'Authorization,Content-Type')
    headers.set('Access-Control-Max-Age', '86400')
  }
  return headers
}

function json(request: NextRequest, error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status, headers: corsHeaders(request) })
}

export async function middleware(request: NextRequest) {
  // /api/v1/* is an alias of /api/*
  const pathname = request.nextUrl.pathname.replace(/^\/api\/v1(\/|$)/, '/api$1')

  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: corsHeaders(request) })
  }

  if (!matches(pathname, publicRoutes)) {
    const token = bearerToken(request.headers.get('authorization'))
    const user = token ? await verifyAccessToken(token) : null
    if (!user) return json(request, 'Unauthorized', 401)

    const isPortalUser = portalRoles.includes(user.role)
    if (isPortalUser && !matches(pathname, portalRoutes)) return json(request, 'Forbidden', 403)
    if (!isPortalUser && matches(pathname, ['/api/portal'])) return json(request, 'Forbidden', 403)

    for (const [route, allowedRoles] of Object.entries(roleRoutes)) {
      if (matches(pathname, [route]) && !allowedRoles.includes(user.role)) {
        return json(request, 'Forbidden', 403)
      }
    }
  }

  const response = NextResponse.next()
  corsHeaders(request).forEach((value, key) => response.headers.set(key, value))
  return response
}

export const config = {
  matcher: ['/api/:path*'],
}
