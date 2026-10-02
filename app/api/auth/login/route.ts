import { NextRequest, NextResponse } from 'next/server'
import { compare } from 'bcryptjs'
import prisma from '@/lib/prisma'
import { withApiHandler, successResponse, errorResponse } from '@/lib/api-utils'
import { issueTokens } from '@/lib/auth-service'
import {
  LOGIN_EMAIL_LIMIT,
  LOGIN_IP_LIMIT,
  clearFailures,
  clientIp,
  recordFailure,
  retryAfter,
} from '@/lib/rate-limit'

function tooManyAttempts(seconds: number) {
  return NextResponse.json(
    { success: false, error: `Too many failed attempts. Try again in ${Math.ceil(seconds / 60)} minute(s).` },
    { status: 429, headers: { 'Retry-After': String(seconds) } }
  )
}

// POST /api/auth/login { email, password } -> { user, accessToken, refreshToken, expiresIn }
export const POST = withApiHandler(
  async (request: NextRequest) => {
    const body = await request.json().catch(() => null)
    const email = typeof body?.email === 'string' ? body.email.toLowerCase().trim() : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    if (!email || !password) return errorResponse('Email and password are required')

    const emailKey = `login:email:${email}`
    const ipKey = `login:ip:${clientIp(request.headers)}`
    const wait = Math.max(await retryAfter(emailKey), await retryAfter(ipKey))
    if (wait > 0) return tooManyAttempts(wait)

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !(await compare(password, user.password))) {
      await Promise.all([recordFailure(emailKey, LOGIN_EMAIL_LIMIT), recordFailure(ipKey, LOGIN_IP_LIMIT)])
      return errorResponse('Invalid email or password', 401)
    }
    if (!user.isActive) {
      return errorResponse('Account is deactivated. Please contact the school office.', 403)
    }

    await clearFailures(emailKey)
    await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } })
    const tokens = await issueTokens(user.id)
    if (!tokens) return errorResponse('Invalid email or password', 401)
    return successResponse(tokens)
  },
  { requireAuth: false }
)
