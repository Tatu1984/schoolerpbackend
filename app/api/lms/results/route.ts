import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  successResponse,
  errorResponse,
  validationErrorResponse,
  validateBody,
  getPaginationParams,
  paginatedResponse,
  getSchoolFilter,
  AuthenticatedSession,
} from '@/lib/api-utils'
import { examResultSchema } from '@/lib/validations'
import { Prisma } from '@prisma/client'

export const GET = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const pagination = getPaginationParams(request)
    const schoolFilter = getSchoolFilter(session)
    const { searchParams } = new URL(request.url)
    const examId = searchParams.get('examId')
    const studentId = searchParams.get('studentId')

    const where: Prisma.ExamResultWhereInput = {
      ...(examId && { examId }),
      ...(studentId && { studentId }),
      ...(schoolFilter.schoolId && {
        exam: { course: { schoolId: schoolFilter.schoolId } },
      }),
    }

    const [results, total] = await Promise.all([
      prisma.examResult.findMany({
        where,
        include: {
          exam: {
            select: { id: true, title: true, maxScore: true, examDate: true },
          },
          student: {
            select: { id: true, firstName: true, lastName: true, rollNumber: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.examResult.count({ where }),
    ])

    return paginatedResponse(results, total, pagination)
  },
  { requireAuth: true, module: 'lms' }
)

export const POST = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const { data, errors } = await validateBody(request, examResultSchema)

    if (errors) {
      return validationErrorResponse(errors)
    }

    if (!data) {
      return errorResponse('Invalid request body')
    }

    const schoolFilter = getSchoolFilter(session)

    // Verify exam exists and belongs to user's school
    const exam = await prisma.exam.findFirst({
      where: {
        id: data.examId,
        ...(schoolFilter.schoolId && { course: { schoolId: schoolFilter.schoolId } }),
      },
    })

    if (!exam) {
      return validationErrorResponse({ examId: ['Exam not found'] })
    }

    // Verify student exists
    const student = await prisma.student.findFirst({
      where: {
        id: data.studentId,
        ...(schoolFilter.schoolId && { schoolId: schoolFilter.schoolId }),
      },
    })

    if (!student) {
      return validationErrorResponse({ studentId: ['Student not found'] })
    }

    // Check for existing result (upsert)
    const existing = await prisma.examResult.findFirst({
      where: {
        examId: data.examId,
        studentId: data.studentId,
      },
    })

    if (existing) {
      const updated = await prisma.examResult.update({
        where: { id: existing.id },
        data: {
          score: data.score,
          remarks: data.remarks,
        },
        include: {
          exam: { select: { id: true, title: true, maxScore: true } },
          student: { select: { id: true, firstName: true, lastName: true } },
        },
      })

      return successResponse(updated)
    }

    const result = await prisma.examResult.create({
      data: {
        examId: data.examId,
        studentId: data.studentId,
        score: data.score,
        remarks: data.remarks,
      },
      include: {
        exam: { select: { id: true, title: true, maxScore: true } },
        student: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    return successResponse(result, 201)
  },
  { requireAuth: true, module: 'lms' }
)
