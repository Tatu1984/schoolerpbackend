import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withApiHandler, successResponse, AuthenticatedSession } from '@/lib/api-utils'

// POST /api/auth/logout-all -> invalidates every token issued to this user, on every device
export const POST = withApiHandler(
  async (_request: NextRequest, _context, session: AuthenticatedSession | null) => {
    await prisma.user.update({ where: { id: session!.user.id }, data: { tokenVersion: { increment: 1 } } })
    return successResponse({ message: 'Signed out everywhere' })
  },
  { requireAuth: true }
)
