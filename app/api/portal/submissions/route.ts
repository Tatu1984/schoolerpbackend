import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  successResponse,
  errorResponse,
  forbiddenResponse,
  AuthenticatedSession,
} from '@/lib/api-utils'

// A student submits (or re-submits, until graded) an assignment of their own class.
export const POST = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const user = session!.user
    if (user.role !== 'STUDENT') return forbiddenResponse('Only students can submit assignments')

    const body = await request.json().catch(() => null)
    const content = typeof body?.content === 'string' ? body.content.trim() : ''
    if (!body?.assignmentId || !content) return errorResponse('Assignment and answer are required')

    const student = await prisma.student.findUnique({ where: { userId: user.id } })
    if (!student) return forbiddenResponse()

    const assignment = await prisma.assignment.findFirst({
      where: { id: body.assignmentId, isActive: true, course: { schoolId: student.schoolId, classId: student.classId } },
    })
    if (!assignment) return errorResponse('Assignment not found', 404)

    const existing = await prisma.assignmentSubmission.findUnique({
      where: { assignmentId_studentId: { assignmentId: assignment.id, studentId: student.id } },
    })
    if (existing?.gradedAt) return errorResponse('This assignment has already been graded')

    const submission = await prisma.assignmentSubmission.upsert({
      where: { assignmentId_studentId: { assignmentId: assignment.id, studentId: student.id } },
      update: { content, submittedAt: new Date() },
      create: { assignmentId: assignment.id, studentId: student.id, content },
    })
    return successResponse(submission, 201)
  },
  { requireAuth: true }
)
