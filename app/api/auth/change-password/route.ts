import { NextRequest } from 'next/server'
import { compare, hash } from 'bcryptjs'
import prisma from '@/lib/prisma'
import { withApiHandler, successResponse, errorResponse, AuthenticatedSession } from '@/lib/api-utils'
import { issueTokens } from '@/lib/auth-service'
import { passwordProblem } from '@/lib/passwords'

// POST /api/auth/change-password { currentPassword, newPassword }
// Signs out every other session and returns a fresh token pair for this one.
export const POST = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const body = await request.json().catch(() => null)
    const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : ''
    const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : ''
    if (!currentPassword || !newPassword) return errorResponse('Current and new password are required')

    const problem = passwordProblem(newPassword)
    if (problem) return errorResponse(problem)
    if (newPassword === currentPassword) return errorResponse('New password must be different from the current one')

    const user = await prisma.user.findUnique({ where: { id: session!.user.id } })
    if (!user || !(await compare(currentPassword, user.password))) {
      return errorResponse('Current password is incorrect', 401)
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: await hash(newPassword, 10),
        mustChangePassword: false,
        tokenVersion: { increment: 1 },
      },
    })
    return successResponse({ message: 'Password changed', ...(await issueTokens(user.id)) })
  },
  { requireAuth: true }
)
