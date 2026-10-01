import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withApiHandler, successResponse, unauthorizedResponse, AuthenticatedSession } from '@/lib/api-utils'

// GET /api/auth/me -> the signed-in user's profile
export const GET = withApiHandler(
  async (_request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const user = await prisma.user.findUnique({
      where: { id: session!.user.id },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        lastLogin: true,
        school: { select: { id: true, name: true } },
      },
    })
    if (!user || !user.isActive) return unauthorizedResponse()
    return successResponse(user)
  },
  { requireAuth: true }
)
