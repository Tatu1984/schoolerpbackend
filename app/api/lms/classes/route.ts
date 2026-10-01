import { NextRequest } from 'next/server'
import { generateMeetingLink } from '@/lib/meeting'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  successResponse,
  errorResponse,
  getSchoolFilter,
  AuthenticatedSession,
} from '@/lib/api-utils'


export const GET = withApiHandler(
  async (_request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const classes = await prisma.onlineClass.findMany({
      where: getSchoolFilter(session),
      include: {
        course: {
          select: {
            id: true,
            name: true,
            code: true,
            class: { select: { id: true, name: true } },
            teacher: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { scheduledTime: 'desc' },
    })
    return successResponse(classes)
  },
  { requireAuth: true, module: 'lms' }
)

export const POST = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const body = await request.json().catch(() => null)
    if (!body?.title || !body?.scheduledTime) {
      return errorResponse('Title and scheduled time are required')
    }
    const scheduledTime = new Date(body.scheduledTime)
    if (isNaN(scheduledTime.getTime())) return errorResponse('Invalid scheduled time')

    const schoolId = session?.user.schoolId
    if (!schoolId) return errorResponse('School ID is required')

    if (body.courseId) {
      const course = await prisma.course.findFirst({ where: { id: body.courseId, schoolId } })
      if (!course) return errorResponse('Invalid course')
    }

    const onlineClass = await prisma.onlineClass.create({
      data: {
        schoolId,
        courseId: body.courseId || null,
        title: body.title,
        description: body.description || null,
        scheduledTime,
        duration: body.duration ? parseInt(body.duration, 10) : null,
        meetingLink: body.meetingLink?.trim() || generateMeetingLink(),
        status: body.status || 'SCHEDULED',
      },
    })
    return successResponse(onlineClass, 201)
  },
  { requireAuth: true, module: 'lms' }
)
