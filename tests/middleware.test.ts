import { beforeAll, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-1234'
  process.env.CORS_ORIGINS = 'https://app.example.com'
})

async function call(path: string, role?: string, init: { method?: string; origin?: string } = {}) {
  const { middleware } = await import('@/middleware')
  const { signAccessToken } = await import('@/lib/jwt')
  const headers: Record<string, string> = {}
  if (role) {
    const token = await signAccessToken({ id: 'u1', email: 'a@b.c', name: 'A', role, schoolId: 's1', tokenVersion: 0 })
    headers.authorization = `Bearer ${token}`
  }
  if (init.origin) headers.origin = init.origin
  return middleware(new NextRequest(`http://localhost${path}`, { method: init.method || 'GET', headers }))
}

// NextResponse.next() carries this header; an early JSON response does not
const passed = (res: Response) => res.headers.get('x-middleware-next') === '1'

describe('API middleware', () => {
  it('lets public endpoints through without a token', async () => {
    for (const path of ['/api/health', '/api/auth/login', '/api/v1/auth/login', '/api/auth/refresh']) {
      expect(passed(await call(path))).toBe(true)
    }
  })

  it('rejects everything else without a valid token', async () => {
    for (const path of ['/api/students', '/api/v1/students', '/api/portal/data', '/api/auth/me']) {
      expect((await call(path)).status).toBe(401)
    }
  })

  it('confines parents and students to portal, auth and account endpoints', async () => {
    for (const role of ['PARENT', 'STUDENT']) {
      expect(passed(await call('/api/portal/data', role))).toBe(true)
      expect(passed(await call('/api/v1/portal/data', role))).toBe(true)
      expect(passed(await call('/api/auth/me', role))).toBe(true)
      expect(passed(await call('/api/account/change-password', role, { method: 'POST' }))).toBe(true)
      expect((await call('/api/students', role)).status).toBe(403)
      expect((await call('/api/v1/finance/fee-due', role)).status).toBe(403)
      expect((await call('/api/portalx', role)).status).toBe(403)
    }
  })

  it('keeps staff out of the portal and non-admins out of security endpoints', async () => {
    expect((await call('/api/portal/data', 'SCHOOL_ADMIN')).status).toBe(403)
    expect(passed(await call('/api/students', 'TEACHER'))).toBe(true)
    expect((await call('/api/security/backups', 'TEACHER')).status).toBe(403)
    expect((await call('/api/roles', 'ACCOUNTANT')).status).toBe(403)
    expect(passed(await call('/api/security/backups', 'SCHOOL_ADMIN'))).toBe(true)
  })

  it('answers CORS preflight only for allowed origins', async () => {
    const ok = await call('/api/students', undefined, { method: 'OPTIONS', origin: 'https://app.example.com' })
    expect(ok.status).toBe(204)
    expect(ok.headers.get('access-control-allow-origin')).toBe('https://app.example.com')
    const bad = await call('/api/students', undefined, { method: 'OPTIONS', origin: 'https://evil.example' })
    expect(bad.headers.get('access-control-allow-origin')).toBeNull()
  })
})
