import { NextRequest } from 'next/server'
import { compare, hash } from 'bcryptjs'
import prisma from '@/lib/prisma'
import { withApiHandler, successResponse, errorResponse, AuthenticatedSession } from '@/lib/api-utils'

// POST /api/auth/change-password { currentPassword, newPassword }
export const POST = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const body = await request.json().catch(() => null)
    const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : ''
    const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : ''
    if (!currentPassword || newPassword.length < 8) {
      return errorResponse('Current password and a new password of at least 8 characters are required')
    }

    const user = await prisma.user.findUnique({ where: { id: session!.user.id } })
    if (!user || !(await compare(currentPassword, user.password))) {
      return errorResponse('Current password is incorrect', 401)
    }

    await prisma.user.update({ where: { id: user.id }, data: { password: await hash(newPassword, 10) } })
    return successResponse({ message: 'Password changed' })
  },
  { requireAuth: true }
)
