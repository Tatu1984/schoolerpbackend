import prisma from './prisma'

// Database-backed counters, so limits hold across serverless instances.

interface Limit {
  max: number
  windowMs: number
  lockMs: number
}

export const LOGIN_EMAIL_LIMIT: Limit = { max: 5, windowMs: 15 * 60_000, lockMs: 15 * 60_000 }
export const LOGIN_IP_LIMIT: Limit = { max: 30, windowMs: 15 * 60_000, lockMs: 15 * 60_000 }

// Seconds until the key may try again, or 0 if it is not locked
export async function retryAfter(key: string): Promise<number> {
  const attempt = await prisma.authAttempt.findUnique({ where: { key } })
  if (!attempt?.lockedUntil) return 0
  const remaining = attempt.lockedUntil.getTime() - Date.now()
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0
}

export async function recordFailure(key: string, limit: Limit) {
  const now = new Date()
  const attempt = await prisma.authAttempt.findUnique({ where: { key } })
  const windowExpired = !attempt || now.getTime() - attempt.windowStart.getTime() > limit.windowMs
  const count = windowExpired ? 1 : attempt.count + 1
  const data = {
    count,
    windowStart: windowExpired ? now : attempt.windowStart,
    lockedUntil: count >= limit.max ? new Date(now.getTime() + limit.lockMs) : null,
  }
  await prisma.authAttempt.upsert({ where: { key }, update: data, create: { key, ...data } })
}

export async function clearFailures(key: string) {
  await prisma.authAttempt.deleteMany({ where: { key } })
}

export function clientIp(headers: Headers) {
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'unknown'
}
