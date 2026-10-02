import { NextRequest } from 'next/server'
import { hash } from 'bcryptjs'
import prisma from '@/lib/prisma'
import { withApiHandler, successResponse, notFoundResponse, AuthenticatedSession } from '@/lib/api-utils'
import { ensureStudentUser, ensureGuardianUser } from '@/lib/accounts'
import { temporaryPassword } from '@/lib/passwords'

// POST /api/students/:id/reset-login
// For a family that is locked out: gives the student and each guardian a new temporary
// password (creating the login if it was missing), signs out their existing sessions,
// and returns the credentials once so the office can hand them over.
export const POST = withApiHandler(
  async (_request: NextRequest, { params }, session: AuthenticatedSession | null) => {
    const student = await prisma.student.findFirst({
      where: {
        id: params.id,
        ...(session!.user.role !== 'SUPER_ADMIN' && { schoolId: session!.user.schoolId || '__no_school__' }),
      },
      include: { guardians: { select: { id: true } } },
    })
    if (!student) return notFoundResponse('Student not found')

    await ensureStudentUser(student.id)
    for (const guardian of student.guardians) await ensureGuardianUser(guardian.id)

    const fresh = await prisma.student.findUnique({
      where: { id: student.id },
      include: {
        user: { select: { id: true, email: true } },
        guardians: { select: { firstName: true, lastName: true, relation: true, user: { select: { id: true, email: true } } } },
      },
    })

    const reset = async (userId: string) => {
      const password = temporaryPassword()
      await prisma.user.update({
        where: { id: userId },
        data: { password: await hash(password, 10), mustChangePassword: true, tokenVersion: { increment: 1 }, isActive: true },
      })
      return password
    }

    const logins: { who: string; email: string; temporaryPassword: string }[] = []
    if (fresh?.user) {
      logins.push({ who: 'Student', email: fresh.user.email, temporaryPassword: await reset(fresh.user.id) })
    }
    const seen = new Set<string>()
    for (const guardian of fresh?.guardians || []) {
      if (!guardian.user || seen.has(guardian.user.id)) continue
      seen.add(guardian.user.id)
      logins.push({
        who: `${guardian.relation} (${guardian.firstName} ${guardian.lastName})`,
        email: guardian.user.email,
        temporaryPassword: await reset(guardian.user.id),
      })
    }
    return successResponse({ logins })
  },
  { requireAuth: true, requiredRoles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL'] }
)
