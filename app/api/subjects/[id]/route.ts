import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  getSchoolFilter,
  successResponse,
  notFoundResponse,
  validateBody,
  validationErrorResponse,
  errorResponse,
} from '@/lib/api-utils'
import { subjectSchema } from '@/lib/validations'
import { logAudit } from '@/lib/audit'

// GET /api/subjects/[id] - Get a specific subject
export const GET = withApiHandler(
  async (request: NextRequest, { params }, session) => {
    const subject = await prisma.subject.findFirst({
      where: {
        id: params.id,
        ...getSchoolFilter(session),
      },
      include: {
        class: {
          select: {
            id: true,
            name: true,
            grade: true,
          },
        },
      },
    })

    if (!subject) {
      return notFoundResponse('Subject not found')
    }

    return successResponse(subject)
  },
  { requireAuth: true, module: 'subjects' }
)

// PUT /api/subjects/[id] - Update a subject
export const PUT = withApiHandler(
  async (request: NextRequest, { params }, session) => {
    const { data, errors } = await validateBody(request, subjectSchema.partial())

    if (errors) {
      return validationErrorResponse(errors)
    }

    // Check if subject exists and belongs to user's school
    const existingSubject = await prisma.subject.findFirst({
      where: {
        id: params.id,
        ...getSchoolFilter(session),
      },
    })

    if (!existingSubject) {
      return notFoundResponse('Subject not found')
    }

    if (data?.code && data.code !== existingSubject.code) {
      const duplicate = await prisma.subject.findFirst({
        where: { schoolId: existingSubject.schoolId, code: data.code, id: { not: params.id } },
      })
      if (duplicate) {
        return validationErrorResponse({ code: ['Subject code already exists in this school'] })
      }
    }

    if (data?.classId) {
      const classExists = await prisma.class.findFirst({
        where: { id: data.classId, schoolId: existingSubject.schoolId },
      })
      if (!classExists) {
        return validationErrorResponse({ classId: ['Invalid class for this school'] })
      }
    }

    const updateData: Record<string, unknown> = {}
    if (data?.name !== undefined) updateData.name = data.name
    if (data?.code !== undefined) updateData.code = data.code
    if (data?.description !== undefined) updateData.description = data.description
    if (data?.classId !== undefined) updateData.classId = data.classId || null
    if (data?.isOptional !== undefined) updateData.isOptional = data.isOptional
    if (data?.isActive !== undefined) updateData.isActive = data.isActive

    const subject = await prisma.subject.update({
      where: { id: params.id },
      data: updateData,
      include: {
        class: {
          select: {
            id: true,
            name: true,
            grade: true,
          },
        },
      },
    })

    await logAudit(session, request, 'UPDATE', 'Subject', params.id, updateData)

    return successResponse(subject)
  },
  { requireAuth: true, module: 'subjects' }
)

// DELETE /api/subjects/[id] - Delete a subject
export const DELETE = withApiHandler(
  async (request: NextRequest, { params }, session) => {
    // Check if subject exists and belongs to user's school
    const subject = await prisma.subject.findFirst({
      where: {
        id: params.id,
        ...getSchoolFilter(session),
      },
    })

    if (!subject) {
      return notFoundResponse('Subject not found')
    }

    // Courses reference the subject without cascade
    const linkedCourses = await prisma.course.count({ where: { subjectId: params.id } })
    if (linkedCourses > 0) {
      return errorResponse('Cannot delete a subject that is used by courses. Deactivate it instead.', 400)
    }

    await prisma.subject.delete({
      where: { id: params.id },
    })

    await logAudit(session, request, 'DELETE', 'Subject', params.id, { name: subject.name, code: subject.code })

    return successResponse({ message: 'Subject deleted successfully' })
  },
  { requireAuth: true, module: 'subjects' }
)
