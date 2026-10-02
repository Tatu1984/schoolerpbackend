import { beforeAll, describe, expect, it } from 'vitest'

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-1234'
})

const user = { id: 'u1', email: 'a@b.c', name: 'A B', role: 'PARENT', schoolId: 's1', schoolName: 'School', tokenVersion: 3 }

describe('jwt', () => {
  it('round-trips an access token with its token version', async () => {
    const { signAccessToken, verifyAccessToken } = await import('@/lib/jwt')
    const claims = await verifyAccessToken(await signAccessToken(user))
    expect(claims).toMatchObject({ id: 'u1', role: 'PARENT', schoolId: 's1', tokenVersion: 3 })
  })

  it('does not accept a refresh token as an access token, or the reverse', async () => {
    const { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } = await import('@/lib/jwt')
    expect(await verifyAccessToken(await signRefreshToken('u1', 3))).toBeNull()
    expect(await verifyRefreshToken(await signAccessToken(user))).toBeNull()
    expect(await verifyRefreshToken(await signRefreshToken('u1', 3))).toEqual({ userId: 'u1', tokenVersion: 3 })
  })

  it('rejects tampered tokens and tokens signed with another secret', async () => {
    const { signAccessToken, verifyAccessToken } = await import('@/lib/jwt')
    const token = await signAccessToken(user)
    expect(await verifyAccessToken(token.slice(0, -2) + 'xx')).toBeNull()
    process.env.JWT_SECRET = 'another-secret-another-secret-another-12'
    expect(await verifyAccessToken(token)).toBeNull()
    process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-1234'
  })

  it('refuses to sign with a missing or short secret', async () => {
    const { signAccessToken } = await import('@/lib/jwt')
    process.env.JWT_SECRET = 'short'
    await expect(signAccessToken(user)).rejects.toThrow(/JWT_SECRET/)
    process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-1234'
  })

  it('parses bearer headers', async () => {
    const { bearerToken } = await import('@/lib/jwt')
    expect(bearerToken('Bearer abc')).toBe('abc')
    expect(bearerToken('bearer abc')).toBe('abc')
    expect(bearerToken('Basic abc')).toBeNull()
    expect(bearerToken(null)).toBeNull()
  })
})
