import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  getSchoolFilter,
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
  AuthenticatedSession
} from '@/lib/api-utils'
import { eventToClient, notEntranceTest, parseEventBody } from '../helpers'

// Scoped to the caller's school (no restriction for SUPER_ADMIN)
function findEvent(id: string, session: AuthenticatedSession | null) {
  return prisma.event.findFirst({
    where: { id, ...getSchoolFilter(session), ...notEntranceTest }
  })
}

export const GET = withApiHandler(
  async (_request: NextRequest, { params }, session: AuthenticatedSession | null) => {
    const event = await findEvent(params.id, session)
    if (!event) {
      return notFoundResponse('Event not found')
    }
    return successResponse(eventToClient(event))
  },
  { requireAuth: true, module: 'communication' }
)

export const PUT = withApiHandler(
  async (request: NextRequest, { params }, session: AuthenticatedSession | null) => {
    const existing = await findEvent(params.id, session)
    if (!existing) {
      return notFoundResponse('Event not found')
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return errorResponse('Invalid request body')
    }

    const { data, errors } = parseEventBody(body, existing)
    if (errors) {
      return validationErrorResponse(errors)
    }

    const event = await prisma.event.update({
      where: { id: params.id },
      data
    })

    return successResponse(eventToClient(event))
  },
  { requireAuth: true, module: 'communication' }
)

export const DELETE = withApiHandler(
  async (_request: NextRequest, { params }, session: AuthenticatedSession | null) => {
    const existing = await findEvent(params.id, session)
    if (!existing) {
      return notFoundResponse('Event not found')
    }

    await prisma.event.delete({
      where: { id: params.id }
    })

    return successResponse({ message: 'Event deleted successfully' })
  },
  { requireAuth: true, module: 'communication' }
)
