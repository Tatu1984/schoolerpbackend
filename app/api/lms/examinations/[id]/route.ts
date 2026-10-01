import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  getSchoolFilter,
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
} from '@/lib/api-utils'
import { Prisma } from '@prisma/client'
import {
  examInclude,
  examToClient,
  findScopedExam,
  parseExamBody,
  readPassingMarks,
  writePassingMarks,
} from '../helpers'

export const GET = withApiHandler(
  async (_request: NextRequest, { params }, session) => {
    const exam = await findScopedExam(params.id, session)
    if (!exam) {
      return notFoundResponse('Examination not found')
    }
    return successResponse(examToClient(exam))
  },
  { requireAuth: true, module: 'lms' }
)

export const PUT = withApiHandler(
  async (request: NextRequest, { params }, session) => {
    const existing = await findScopedExam(params.id, session)
    if (!existing) {
      return notFoundResponse('Examination not found')
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return errorResponse('Invalid request body')
    }

    const { data, errors } = parseExamBody(body, true)
    if (errors) {
      return validationErrorResponse(errors)
    }

    const update: Prisma.ExamUncheckedUpdateInput = {}
    if (data.title !== undefined) update.title = data.title
    if (data.examDate !== undefined) update.examDate = data.examDate
    if (data.duration !== undefined) update.duration = data.duration
    if (data.maxScore !== undefined) update.maxScore = data.maxScore
    if (data.isActive !== undefined) update.isActive = data.isActive

    if (data.courseId !== undefined && data.courseId !== existing.courseId) {
      const course = await prisma.course.findFirst({
        where: { id: data.courseId, ...getSchoolFilter(session) },
      })
      if (!course) {
        return validationErrorResponse({ courseId: ['Course not found'] })
      }
      update.courseId = course.id
    }

    if (data.description !== undefined || data.passingMarks !== undefined) {
      const passingMarks =
        data.passingMarks !== undefined ? data.passingMarks : readPassingMarks(existing.description)
      const maxScore = data.maxScore ?? existing.maxScore
      if (passingMarks !== null && passingMarks > maxScore) {
        return validationErrorResponse({ passingMarks: ['Passing marks cannot exceed total marks'] })
      }
      update.description = writePassingMarks(
        data.description !== undefined ? data.description : existing.description,
        passingMarks
      )
    }

    const exam = await prisma.exam.update({
      where: { id: params.id },
      data: update,
      include: examInclude,
    })

    return successResponse(examToClient(exam))
  },
  { requireAuth: true, module: 'lms' }
)

export const DELETE = withApiHandler(
  async (_request: NextRequest, { params }, session) => {
    const existing = await findScopedExam(params.id, session)
    if (!existing) {
      return notFoundResponse('Examination not found')
    }

    // Results cascade on delete (see schema)
    await prisma.exam.delete({ where: { id: params.id } })

    return successResponse({ message: 'Examination deleted successfully' })
  },
  { requireAuth: true, module: 'lms' }
)
