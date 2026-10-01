import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  successResponse,
  errorResponse,
  notFoundResponse,
  validateBody,
  validationErrorResponse,
  AuthenticatedSession,
} from '@/lib/api-utils'
import { sectionSchema } from '@/lib/validations'
import { logAudit } from '@/lib/audit'

// Section has no schoolId column; ownership is checked through its class.
function sectionScope(id: string, session: AuthenticatedSession | null) {
  return {
    id,
    ...(session?.user.role !== 'SUPER_ADMIN' && {
      class: { schoolId: session?.user.schoolId || '__no_school__' },
    }),
  }
}

const sectionInclude = {
  class: { select: { id: true, name: true, grade: true, schoolId: true } },
  teacher: { select: { id: true, firstName: true, lastName: true, email: true } },
  _count: { select: { students: true } },
}

// GET /api/sections/[id] - Get a specific section
export const GET = withApiHandler(
  async (_request: NextRequest, { params }, session) => {
    const section = await prisma.section.findFirst({
      where: sectionScope(params.id, session),
      include: sectionInclude,
    })

    if (!section) {
      return notFoundResponse('Section not found')
    }

    return successResponse(section)
  },
  { requireAuth: true, module: 'sections' }
)

// PUT /api/sections/[id] - Update a section
export const PUT = withApiHandler(
  async (request: NextRequest, { params }, session) => {
    const { data, errors } = await validateBody(request, sectionSchema.partial())

    if (errors) {
      return validationErrorResponse(errors)
    }
    if (!data) {
      return errorResponse('Invalid request body')
    }

    const existingSection = await prisma.section.findFirst({
      where: sectionScope(params.id, session),
      include: { class: { select: { schoolId: true } } },
    })

    if (!existingSection) {
      return notFoundResponse('Section not found')
    }

    let schoolId = existingSection.class.schoolId
    const classId = data.classId || existingSection.classId

    if (classId !== existingSection.classId) {
      const classItem = await prisma.class.findFirst({
        where: {
          id: classId,
          ...(session?.user.role !== 'SUPER_ADMIN' && { schoolId }),
        },
      })
      if (!classItem) {
        return validationErrorResponse({ classId: ['Invalid class'] })
      }
      schoolId = classItem.schoolId
    }

    // '' means "unassign teacher"
    const teacherId = data.teacherId === undefined ? undefined : data.teacherId || null
    if (teacherId) {
      const teacher = await prisma.staff.findFirst({ where: { id: teacherId, schoolId } })
      if (!teacher) {
        return validationErrorResponse({ teacherId: ['Invalid teacher'] })
      }
    }

    const name = data.name ?? existingSection.name
    if (name !== existingSection.name || classId !== existingSection.classId) {
      const duplicate = await prisma.section.findFirst({
        where: { classId, name, id: { not: params.id } },
      })
      if (duplicate) {
        return validationErrorResponse({
          name: ['Section with this name already exists in this class'],
        })
      }
    }

    const section = await prisma.section.update({
      where: { id: params.id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.classId && { classId }),
        ...(teacherId !== undefined && { teacherId }),
        ...(data.capacity !== undefined && { capacity: data.capacity }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      include: sectionInclude,
    })

    await logAudit(session, request, 'UPDATE', 'Section', section.id, data)

    return successResponse(section)
  },
  { requireAuth: true, module: 'sections' }
)

// DELETE /api/sections/[id] - Delete a section
export const DELETE = withApiHandler(
  async (request: NextRequest, { params }, session) => {
    const section = await prisma.section.findFirst({
      where: sectionScope(params.id, session),
      include: { _count: { select: { students: true } } },
    })

    if (!section) {
      return notFoundResponse('Section not found')
    }

    if (section._count.students > 0) {
      return errorResponse('Cannot delete a section that still has students assigned to it', 400)
    }

    await prisma.section.delete({
      where: { id: params.id },
    })

    await logAudit(session, request, 'DELETE', 'Section', params.id, { name: section.name })

    return successResponse({ message: 'Section deleted successfully' })
  },
  { requireAuth: true, module: 'sections' }
)
