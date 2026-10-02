import { SignJWT, jwtVerify } from 'jose'

// Stateless bearer tokens, shared by the web frontend and the mobile apps.
// This module is imported by middleware, so it must stay edge-compatible (no Node APIs).

export interface TokenUser {
  id: string
  email: string
  name: string
  role: string
  schoolId: string
  schoolName?: string
  // Matches User.tokenVersion at the time of issue
  tokenVersion: number
}

export const ACCESS_TOKEN_TTL_SECONDS = parseInt(process.env.ACCESS_TOKEN_TTL_SECONDS || `${8 * 60 * 60}`, 10)
export const REFRESH_TOKEN_TTL_SECONDS = parseInt(process.env.REFRESH_TOKEN_TTL_SECONDS || `${30 * 24 * 60 * 60}`, 10)

function secret() {
  const value = process.env.JWT_SECRET
  if (!value || value.length < 32) {
    throw new Error('JWT_SECRET must be set to a random string of at least 32 characters')
  }
  return new TextEncoder().encode(value)
}

async function sign(payload: Record<string, unknown>, subject: string, ttlSeconds: number) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds)
    .sign(secret())
}

export function signAccessToken(user: TokenUser) {
  const { id, ...claims } = user
  return sign({ ...claims, type: 'access' }, id, ACCESS_TOKEN_TTL_SECONDS)
}

export function signRefreshToken(userId: string, tokenVersion: number) {
  return sign({ type: 'refresh', tokenVersion }, userId, REFRESH_TOKEN_TTL_SECONDS)
}

export async function verifyAccessToken(token: string): Promise<TokenUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] })
    if (payload.type !== 'access' || !payload.sub) return null
    return {
      id: payload.sub,
      email: payload.email as string,
      name: payload.name as string,
      role: payload.role as string,
      schoolId: payload.schoolId as string,
      schoolName: payload.schoolName as string | undefined,
      tokenVersion: typeof payload.tokenVersion === 'number' ? payload.tokenVersion : 0,
    }
  } catch {
    return null
  }
}

export async function verifyRefreshToken(token: string): Promise<{ userId: string; tokenVersion: number } | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] })
    if (payload.type !== 'refresh' || !payload.sub) return null
    return { userId: payload.sub, tokenVersion: typeof payload.tokenVersion === 'number' ? payload.tokenVersion : 0 }
  } catch {
    return null
  }
}

export function bearerToken(authorization: string | null) {
  if (!authorization) return null
  const [scheme, token] = authorization.split(' ')
  return scheme?.toLowerCase() === 'bearer' && token ? token : null
}
