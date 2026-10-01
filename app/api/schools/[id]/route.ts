import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  successResponse,
  notFoundResponse,
  errorResponse,
  validationErrorResponse,
  validateBody,
  hasRole,
  AuthenticatedSession,
} from '@/lib/api-utils'
import { schoolSchema } from '@/lib/validations'
import { logAudit } from '@/lib/audit'

const schoolUpdateSchema = schoolSchema.partial()

export const GET = withApiHandler(
  async (_request: NextRequest, context, session: AuthenticatedSession | null) => {
    const { id } = await context.params

    // Non-super admins can only view their own school
    if (session?.user.role !== 'SUPER_ADMIN' && session?.user.schoolId !== id) {
      return errorResponse('Access denied', 403)
    }

    const school = await prisma.school.findUnique({
      where: { id },
      include: {
        branches: {
          select: { id: true, name: true, code: true, isActive: true },
        },
        academicYears: {
          select: { id: true, name: true, isCurrent: true },
          orderBy: { startDate: 'desc' },
        },
        _count: {
          select: {
            users: true,
            students: true,
            staff: true,
            classes: true,
          },
        },
      },
    })

    if (!school) {
      return notFoundResponse('School not found')
    }

    return successResponse(school)
  },
  { requireAuth: true, module: 'schools' }
)

export const PUT = withApiHandler(
  async (request: NextRequest, context, session: AuthenticatedSession | null) => {
    const { id } = await context.params

    // Only super admin can update any school, school admin can update their own
    if (
      session?.user.role !== 'SUPER_ADMIN' &&
      !(session?.user.role === 'SCHOOL_ADMIN' && session?.user.schoolId === id)
    ) {
      return errorResponse('Access denied', 403)
    }

    const existingSchool = await prisma.school.findUnique({
      where: { id },
    })

    if (!existingSchool) {
      return notFoundResponse('School not found')
    }

    const { data, errors } = await validateBody(request, schoolUpdateSchema)

    if (errors) {
      return validationErrorResponse(errors)
    }

    if (!data) {
      return errorResponse('Invalid request body')
    }

    // Check for unique constraints if updating code or name
    if (data.code && data.code !== existingSchool.code) {
      const codeExists = await prisma.school.findFirst({
        where: { code: data.code, id: { not: id } },
      })
      if (codeExists) {
        return validationErrorResponse({ code: ['School code already exists'] })
      }
    }

    if (data.name && data.name !== existingSchool.name) {
      const nameExists = await prisma.school.findFirst({
        where: { name: data.name, id: { not: id } },
      })
      if (nameExists) {
        return validationErrorResponse({ name: ['School name already exists'] })
      }
    }

    const school = await prisma.school.update({
      where: { id },
      data: {
        ...data,
        ...(data.email !== undefined && { email: data.email ? data.email.toLowerCase() : null }),
        ...(data.phone !== undefined && { phone: data.phone || null }),
        // Only touch the date when the client actually sent the field
        established:
          data.established === undefined ? undefined : data.established ? new Date(data.established) : null,
      },
    })

    await logAudit(session, request, 'UPDATE', 'School', id, { fields: Object.keys(data) })

    return successResponse(school)
  },
  { requireAuth: true, module: 'schools' }
)

export const DELETE = withApiHandler(
  async (_request: NextRequest, context, session: AuthenticatedSession | null) => {
    const { id } = await context.params

    // Only super admin can delete schools
    if (!session || !hasRole(session.user.role, ['SUPER_ADMIN'])) {
      return errorResponse('Only super admins can delete schools', 403)
    }

    const existingSchool = await prisma.school.findUnique({
      where: { id },
      include: {
        _count: {
          select: { users: true, students: true, staff: true },
        },
      },
    })

    if (!existingSchool) {
      return notFoundResponse('School not found')
    }

    // Prevent deletion if school has data
    if (
      existingSchool._count.users > 0 ||
      existingSchool._count.students > 0 ||
      existingSchool._count.staff > 0
    ) {
      return errorResponse(
        'Cannot delete school with existing users, students, or staff. Deactivate instead.',
        400
      )
    }

    await prisma.school.delete({
      where: { id },
    })

    return successResponse({ message: 'School deleted successfully' })
  },
  { requireAuth: true, module: 'schools' }
)
