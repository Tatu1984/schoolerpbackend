import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  getSchoolFilter,
  successResponse,
  errorResponse,
  validationErrorResponse,
} from '@/lib/api-utils'

const include = {
  course: { select: { id: true, name: true, code: true, schoolId: true } },
  _count: { select: { submissions: true } },
}

// The dashboard page works with `totalMarks`; Prisma stores `maxScore`.
function toClient<T extends { maxScore: number }>(assignment: T) {
  return { ...assignment, totalMarks: assignment.maxScore }
}

export const GET = withApiHandler(
  async (request: NextRequest, _context, session) => {
    const schoolFilter = getSchoolFilter(session)
    const { searchParams } = new URL(request.url)
    const courseId = searchParams.get('courseId')

    const assignments = await prisma.assignment.findMany({
      where: {
        ...(schoolFilter.schoolId ? { course: { schoolId: schoolFilter.schoolId } } : {}),
        ...(courseId ? { courseId } : {}),
      },
      include,
      orderBy: { createdAt: 'desc' },
    })

    return successResponse(assignments.map(toClient))
  },
  { requireAuth: true, module: 'lms' }
)

export const POST = withApiHandler(
  async (request: NextRequest, _context, session) => {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return errorResponse('Invalid request body')
    }

    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const courseId = typeof body.courseId === 'string' ? body.courseId : ''
    const maxScore = Number(body.totalMarks ?? body.maxScore)
    const dueDate = body.dueDate ? new Date(body.dueDate) : null

    const errors: Record<string, string[]> = {}
    if (!title) errors.title = ['Title is required']
    if (!courseId) errors.courseId = ['Course is required']
    if (!dueDate || isNaN(dueDate.getTime())) errors.dueDate = ['A valid due date is required']
    if (!Number.isFinite(maxScore) || maxScore <= 0) errors.totalMarks = ['Total marks must be a positive number']
    if (Object.keys(errors).length) {
      return validationErrorResponse(errors)
    }

    // Verify course exists and belongs to user's school
    const course = await prisma.course.findFirst({
      where: { id: courseId, ...getSchoolFilter(session) },
    })
    if (!course) {
      return validationErrorResponse({ courseId: ['Course not found'] })
    }

    const assignment = await prisma.assignment.create({
      data: {
        courseId,
        title,
        description: body.description || null,
        dueDate: dueDate!,
        maxScore,
        isActive: typeof body.isActive === 'boolean' ? body.isActive : true,
      },
      include,
    })

    return successResponse(toClient(assignment), 201)
  },
  { requireAuth: true, module: 'lms' }
)
