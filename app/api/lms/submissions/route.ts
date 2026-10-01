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
import { assignmentSubmissionSchema } from '@/lib/validations'
import { Prisma } from '@prisma/client'

export const GET = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const pagination = getPaginationParams(request)
    const schoolFilter = getSchoolFilter(session)
    const { searchParams } = new URL(request.url)
    const assignmentId = searchParams.get('assignmentId')
    const studentId = searchParams.get('studentId')

    const where: Prisma.AssignmentSubmissionWhereInput = {
      ...(assignmentId && { assignmentId }),
      ...(studentId && { studentId }),
      ...(schoolFilter.schoolId && {
        assignment: { course: { schoolId: schoolFilter.schoolId } },
      }),
    }

    const [submissions, total] = await Promise.all([
      prisma.assignmentSubmission.findMany({
        where,
        include: {
          assignment: {
            select: { id: true, title: true, dueDate: true, maxScore: true },
          },
          student: {
            select: { id: true, firstName: true, lastName: true, rollNumber: true },
          },
        },
        orderBy: { submittedAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.assignmentSubmission.count({ where }),
    ])

    return paginatedResponse(submissions, total, pagination)
  },
  { requireAuth: true, module: 'lms' }
)

export const POST = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const { data, errors } = await validateBody(request, assignmentSubmissionSchema)

    if (errors) {
      return validationErrorResponse(errors)
    }

    if (!data) {
      return errorResponse('Invalid request body')
    }

    const schoolFilter = getSchoolFilter(session)

    // Verify assignment exists and belongs to user's school
    const assignment = await prisma.assignment.findFirst({
      where: {
        id: data.assignmentId,
        ...(schoolFilter.schoolId && { course: { schoolId: schoolFilter.schoolId } }),
      },
    })

    if (!assignment) {
      return validationErrorResponse({ assignmentId: ['Assignment not found'] })
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

    // Check for existing submission
    const existing = await prisma.assignmentSubmission.findFirst({
      where: {
        assignmentId: data.assignmentId,
        studentId: data.studentId,
      },
    })

    if (existing) {
      // Update existing submission
      const updated = await prisma.assignmentSubmission.update({
        where: { id: existing.id },
        data: {
          content: data.content,
          attachments: data.attachments as Prisma.InputJsonValue | undefined,
          submittedAt: new Date(),
        },
        include: {
          assignment: { select: { id: true, title: true } },
          student: { select: { id: true, firstName: true, lastName: true } },
        },
      })

      return successResponse(updated)
    }

    const submission = await prisma.assignmentSubmission.create({
      data: {
        assignmentId: data.assignmentId,
        studentId: data.studentId,
        content: data.content,
        attachments: data.attachments as Prisma.InputJsonValue | undefined,
      },
      include: {
        assignment: { select: { id: true, title: true } },
        student: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    return successResponse(submission, 201)
  },
  { requireAuth: true, module: 'lms' }
)
