import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  getSchoolFilter,
  successResponse,
  errorResponse,
  validationErrorResponse,
} from '@/lib/api-utils'
import { examInclude, examToClient, parseExamBody, writePassingMarks } from './helpers'

export const GET = withApiHandler(
  async (request: NextRequest, _context, session) => {
    const schoolFilter = getSchoolFilter(session)
    const { searchParams } = new URL(request.url)
    const courseId = searchParams.get('courseId')

    // Exams don't have schoolId directly - filter through course
    const exams = await prisma.exam.findMany({
      where: {
        ...(schoolFilter.schoolId ? { course: { schoolId: schoolFilter.schoolId } } : {}),
        ...(courseId ? { courseId } : {}),
      },
      include: examInclude,
      orderBy: { examDate: 'desc' },
    })

    return successResponse(exams.map(examToClient))
  },
  { requireAuth: true, module: 'lms' }
)

export const POST = withApiHandler(
  async (request: NextRequest, _context, session) => {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return errorResponse('Invalid request body')
    }

    const { data, errors } = parseExamBody(body, false)
    if (errors) {
      return validationErrorResponse(errors)
    }

    // Verify course exists and belongs to user's school
    const course = await prisma.course.findFirst({
      where: { id: data.courseId, ...getSchoolFilter(session) },
    })
    if (!course) {
      return validationErrorResponse({ courseId: ['Course not found'] })
    }

    const exam = await prisma.exam.create({
      data: {
        courseId: course.id,
        title: data.title!,
        description: writePassingMarks(data.description, data.passingMarks ?? null),
        examDate: data.examDate!,
        duration: data.duration ?? null,
        maxScore: data.maxScore!,
        isActive: data.isActive ?? true,
      },
      include: examInclude,
    })

    return successResponse(examToClient(exam), 201)
  },
  { requireAuth: true, module: 'lms' }
)
