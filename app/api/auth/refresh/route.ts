import { NextRequest } from 'next/server'
import { withApiHandler, successResponse, errorResponse } from '@/lib/api-utils'
import { verifyRefreshToken } from '@/lib/jwt'
import { issueTokens } from '@/lib/auth-service'

// POST /api/auth/refresh { refreshToken } -> a fresh access + refresh token pair.
// The user is re-read from the database, so a deactivated account cannot refresh.
export const POST = withApiHandler(
  async (request: NextRequest) => {
    const body = await request.json().catch(() => null)
    const userId = typeof body?.refreshToken === 'string' ? await verifyRefreshToken(body.refreshToken) : null
    if (!userId) return errorResponse('Invalid or expired refresh token', 401)

    const tokens = await issueTokens(userId)
    if (!tokens) return errorResponse('Invalid or expired refresh token', 401)
    return successResponse(tokens)
  },
  { requireAuth: false }
)
