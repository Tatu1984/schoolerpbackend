import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  getSchoolFilter,
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
  AuthenticatedSession,
} from '@/lib/api-utils'
import { Prisma } from '@prisma/client'

const include = {
  course: { select: { id: true, name: true, code: true, schoolId: true } },
  _count: { select: { submissions: true } },
}

function toClient<T extends { maxScore: number }>(assignment: T) {
  return { ...assignment, totalMarks: assignment.maxScore }
}

// Assignments have no schoolId - scope through the parent course
function findScoped(id: string, session: AuthenticatedSession | null) {
  const schoolFilter = getSchoolFilter(session)
  return prisma.assignment.findFirst({
    where: {
      id,
      ...(schoolFilter.schoolId ? { course: { schoolId: schoolFilter.schoolId } } : {}),
    },
    include,
  })
}

export const GET = withApiHandler(
  async (_request: NextRequest, { params }, session) => {
    const assignment = await findScoped(params.id, session)
    if (!assignment) {
      return notFoundResponse('Assignment not found')
    }
    return successResponse(toClient(assignment))
  },
  { requireAuth: true, module: 'lms' }
)

export const PUT = withApiHandler(
  async (request: NextRequest, { params }, session) => {
    const existing = await findScoped(params.id, session)
    if (!existing) {
      return notFoundResponse('Assignment not found')
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return errorResponse('Invalid request body')
    }

    const errors: Record<string, string[]> = {}
    const data: Prisma.AssignmentUncheckedUpdateInput = {}

    if (body.title !== undefined) {
      const title = String(body.title).trim()
      if (!title) errors.title = ['Title is required']
      data.title = title
    }
    if (body.description !== undefined) {
      data.description = body.description || null
    }
    if (body.dueDate !== undefined) {
      const dueDate = new Date(body.dueDate)
      if (!body.dueDate || isNaN(dueDate.getTime())) errors.dueDate = ['A valid due date is required']
      else data.dueDate = dueDate
    }
    const rawScore = body.totalMarks ?? body.maxScore
    if (rawScore !== undefined) {
      const maxScore = Number(rawScore)
      if (!Number.isFinite(maxScore) || maxScore <= 0) errors.totalMarks = ['Total marks must be a positive number']
      else data.maxScore = maxScore
    }
    if (typeof body.isActive === 'boolean') {
      data.isActive = body.isActive
    }
    if (body.courseId !== undefined && body.courseId !== existing.courseId) {
      const course = await prisma.course.findFirst({
        where: { id: String(body.courseId), ...getSchoolFilter(session) },
      })
      if (!course) errors.courseId = ['Course not found']
      else data.courseId = course.id
    }

    if (Object.keys(errors).length) {
      return validationErrorResponse(errors)
    }

    const assignment = await prisma.assignment.update({
      where: { id: params.id },
      data,
      include,
    })

    return successResponse(toClient(assignment))
  },
  { requireAuth: true, module: 'lms' }
)

export const DELETE = withApiHandler(
  async (_request: NextRequest, { params }, session) => {
    const existing = await findScoped(params.id, session)
    if (!existing) {
      return notFoundResponse('Assignment not found')
    }

    // Submissions cascade on delete (see schema)
    await prisma.assignment.delete({ where: { id: params.id } })

    return successResponse({ message: 'Assignment deleted successfully' })
  },
  { requireAuth: true, module: 'lms' }
)
