import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  successResponse,
  errorResponse,
  notFoundResponse,
  getSchoolFilter,
  AuthenticatedSession,
} from '@/lib/api-utils'
import { generateMeetingLink } from '@/lib/meeting'

export const PUT = withApiHandler(
  async (request: NextRequest, { params }, session: AuthenticatedSession | null) => {
    const existing = await prisma.onlineClass.findFirst({
      where: { id: params.id, ...getSchoolFilter(session) },
    })
    if (!existing) return notFoundResponse('Online class not found')

    const body = await request.json().catch(() => null)
    if (!body) return errorResponse('Invalid request body')

    const scheduledTime = body.scheduledTime ? new Date(body.scheduledTime) : existing.scheduledTime
    if (isNaN(scheduledTime.getTime())) return errorResponse('Invalid scheduled time')

    if (body.courseId) {
      const course = await prisma.course.findFirst({
        where: { id: body.courseId, schoolId: existing.schoolId },
      })
      if (!course) return errorResponse('Invalid course')
    }

    const updated = await prisma.onlineClass.update({
      where: { id: existing.id },
      data: {
        title: body.title ?? existing.title,
        description: body.description ?? existing.description,
        courseId: body.courseId === undefined ? existing.courseId : body.courseId || null,
        scheduledTime,
        duration: body.duration ? parseInt(body.duration, 10) : existing.duration,
        meetingLink: body.meetingLink?.trim() || existing.meetingLink || generateMeetingLink(),
        recordingLink: body.recordingLink ?? existing.recordingLink,
        status: body.status ?? existing.status,
      },
    })
    return successResponse(updated)
  },
  { requireAuth: true, module: 'lms' }
)

export const DELETE = withApiHandler(
  async (_request: NextRequest, { params }, session: AuthenticatedSession | null) => {
    const existing = await prisma.onlineClass.findFirst({
      where: { id: params.id, ...getSchoolFilter(session) },
    })
    if (!existing) return notFoundResponse('Online class not found')
    await prisma.onlineClass.delete({ where: { id: existing.id } })
    return successResponse({ message: 'Online class deleted' })
  },
  { requireAuth: true, module: 'lms' }
)
