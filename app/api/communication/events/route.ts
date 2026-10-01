import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import {
  withApiHandler,
  getSchoolFilter,
  getPaginationParams,
  successResponse,
  errorResponse,
  paginatedResponse,
  validationErrorResponse,
  AuthenticatedSession
} from '@/lib/api-utils'
import { eventToClient, notEntranceTest, parseEventBody } from './helpers'

export const GET = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const pagination = getPaginationParams(request)
    const { searchParams } = new URL(request.url)
    const isActive = searchParams.get('isActive')

    // The events page shows every event and computes its counters from the
    // list, so only page when the caller asks for a page size.
    if (!searchParams.has('limit')) {
      pagination.limit = 1000
      pagination.skip = (pagination.page - 1) * pagination.limit
    }

    const where: Prisma.EventWhereInput = {
      ...getSchoolFilter(session),
      ...notEntranceTest,
      ...(isActive !== null ? { isActive: isActive === 'true' } : {}),
    }

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        orderBy: { eventDate: 'desc' },
        skip: pagination.skip,
        take: pagination.limit
      }),
      prisma.event.count({ where })
    ])

    return paginatedResponse(events.map(eventToClient), total, pagination)
  },
  { requireAuth: true, module: 'communication' }
)

export const POST = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return errorResponse('Invalid request body')
    }

    // Non super-admins always create events in their own school
    const schoolId =
      session?.user.role === 'SUPER_ADMIN'
        ? body.schoolId || session?.user.schoolId
        : session?.user.schoolId || body.schoolId
    if (!schoolId) {
      return errorResponse('School ID is required')
    }

    const { data, errors } = parseEventBody(body)
    if (errors) {
      return validationErrorResponse(errors)
    }

    const event = await prisma.event.create({
      data: {
        schoolId,
        title: data.title!,
        description: data.description ?? null,
        eventDate: data.eventDate!,
        location: data.location ?? null,
        organizer: data.organizer ?? null,
        isPublic: data.isPublic ?? true,
        isActive: data.isActive ?? true,
      }
    })

    return successResponse(eventToClient(event), 201)
  },
  { requireAuth: true, module: 'communication' }
)
