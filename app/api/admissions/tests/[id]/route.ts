import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  getSchoolFilter,
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
  AuthenticatedSession,
} from '@/lib/api-utils'
import {
  ENTRANCE_TEST_ORGANIZER,
  entranceTestToClient,
  readEntranceTestDetails,
} from '@/lib/entrance-tests'
import { parseTestBody, toEventDate } from '../helpers'

function findTest(id: string, session: AuthenticatedSession | null) {
  return prisma.event.findFirst({
    where: { id, organizer: ENTRANCE_TEST_ORGANIZER, ...getSchoolFilter(session) },
  })
}

export const GET = withApiHandler(
  async (_request: NextRequest, { params }, session: AuthenticatedSession | null) => {
    const test = await findTest(params.id, session)
    if (!test) {
      return notFoundResponse('Entrance test not found')
    }
    return successResponse(entranceTestToClient(test))
  },
  { requireAuth: true, module: 'admissions' }
)

export const PUT = withApiHandler(
  async (request: NextRequest, { params }, session: AuthenticatedSession | null) => {
    // Check if test exists and belongs to user's school
    const existing = await findTest(params.id, session)
    if (!existing) {
      return notFoundResponse('Entrance test not found')
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return errorResponse('Invalid request body')
    }

    const { parsed, errors } = parseTestBody(body, true)
    if (errors) {
      return validationErrorResponse(errors)
    }

    const details = { ...readEntranceTestDetails(existing), ...parsed.details }

    const test = await prisma.event.update({
      where: { id: params.id },
      data: {
        ...(parsed.title !== undefined ? { title: parsed.title } : {}),
        ...(parsed.location !== undefined ? { location: parsed.location || null } : {}),
        description: JSON.stringify(details),
        eventDate: toEventDate(details),
      },
    })

    return successResponse(entranceTestToClient(test))
  },
  { requireAuth: true, module: 'admissions' }
)

export const DELETE = withApiHandler(
  async (_request: NextRequest, { params }, session: AuthenticatedSession | null) => {
    // Check if test exists and belongs to user's school
    const existing = await findTest(params.id, session)
    if (!existing) {
      return notFoundResponse('Entrance test not found')
    }

    await prisma.event.delete({ where: { id: params.id } })

    return successResponse({ message: 'Entrance test deleted successfully' })
  },
  { requireAuth: true, module: 'admissions' }
)
