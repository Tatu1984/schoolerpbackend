import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withApiHandler, successResponse, errorResponse } from '@/lib/api-utils'
import { verifyRefreshToken } from '@/lib/jwt'
import { issueTokens } from '@/lib/auth-service'

// POST /api/auth/refresh { refreshToken } -> a fresh access + refresh token pair.
// The user is re-read from the database, so a deactivated account, or one whose
// password has changed since the token was issued, cannot refresh.
export const POST = withApiHandler(
  async (request: NextRequest) => {
    const body = await request.json().catch(() => null)
    const claims = typeof body?.refreshToken === 'string' ? await verifyRefreshToken(body.refreshToken) : null
    if (!claims) return errorResponse('Invalid or expired refresh token', 401)

    const user = await prisma.user.findUnique({
      where: { id: claims.userId },
      select: { isActive: true, tokenVersion: true },
    })
    if (!user || !user.isActive || user.tokenVersion !== claims.tokenVersion) {
      return errorResponse('Invalid or expired refresh token', 401)
    }

    const tokens = await issueTokens(claims.userId)
    if (!tokens) return errorResponse('Invalid or expired refresh token', 401)
    return successResponse(tokens)
  },
  { requireAuth: false }
)
