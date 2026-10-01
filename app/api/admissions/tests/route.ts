import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  getSchoolFilter,
  paginatedResponse,
  successResponse,
  errorResponse,
  validationErrorResponse,
  AuthenticatedSession,
} from '@/lib/api-utils'
import {
  ENTRANCE_TEST_ORGANIZER,
  EntranceTestDetails,
  entranceTestToClient,
} from '@/lib/entrance-tests'
import { getListParams, resolveSchoolId } from '../helpers'
import { parseTestBody, toEventDate } from './helpers'

// Entrance test sessions - see lib/entrance-tests.ts for how they are stored.
export const GET = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const pagination = getListParams(request)
    const where = { ...getSchoolFilter(session), organizer: ENTRANCE_TEST_ORGANIZER }

    const [tests, total] = await Promise.all([
      prisma.event.findMany({
        where,
        orderBy: { eventDate: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.event.count({ where }),
    ])

    return paginatedResponse(tests.map(entranceTestToClient), total, pagination)
  },
  { requireAuth: true, module: 'admissions' }
)

export const POST = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return errorResponse('Invalid request body')
    }

    const schoolId = resolveSchoolId(session, body.schoolId)
    if (!schoolId) {
      return errorResponse('School ID is required')
    }

    const { parsed, errors } = parseTestBody(body, false)
    if (errors) {
      return validationErrorResponse(errors)
    }

    const details: EntranceTestDetails = {
      testDate: parsed.details.testDate!,
      testTime: parsed.details.testTime || '',
      duration: parsed.details.duration ?? 60,
      maxSeats: parsed.details.maxSeats ?? 50,
      classLevel: parsed.details.classLevel || '',
      syllabus: parsed.details.syllabus || '',
      instructions: parsed.details.instructions || '',
    }

    const test = await prisma.event.create({
      data: {
        schoolId,
        title: parsed.title!,
        description: JSON.stringify(details),
        eventDate: toEventDate(details),
        location: parsed.location || null,
        organizer: ENTRANCE_TEST_ORGANIZER,
        isPublic: false,
      },
    })

    return successResponse(entranceTestToClient(test), 201)
  },
  { requireAuth: true, module: 'admissions' }
)
