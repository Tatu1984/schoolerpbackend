import { NextRequest } from 'next/server'
import { compare } from 'bcryptjs'
import prisma from '@/lib/prisma'
import { withApiHandler, successResponse, errorResponse } from '@/lib/api-utils'
import { issueTokens } from '@/lib/auth-service'

// POST /api/auth/login { email, password } -> { user, accessToken, refreshToken, expiresIn }
export const POST = withApiHandler(
  async (request: NextRequest) => {
    const body = await request.json().catch(() => null)
    const email = typeof body?.email === 'string' ? body.email.toLowerCase().trim() : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    if (!email || !password) return errorResponse('Email and password are required')

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !(await compare(password, user.password))) {
      return errorResponse('Invalid email or password', 401)
    }
    if (!user.isActive) {
      return errorResponse('Account is deactivated. Please contact the school office.', 403)
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } })
    const tokens = await issueTokens(user.id)
    if (!tokens) return errorResponse('Invalid email or password', 401)
    return successResponse(tokens)
  },
  { requireAuth: false }
)
