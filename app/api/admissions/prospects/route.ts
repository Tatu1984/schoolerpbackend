import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  getSchoolFilter,
  successResponse,
  errorResponse,
  validationErrorResponse,
  paginatedResponse,
  AuthenticatedSession,
} from '@/lib/api-utils'
import {
  createAdmission,
  getListParams,
  prospectToClient,
  PROSPECT_SOURCES,
  PROSPECT_STATUSES,
} from '../helpers'

export const GET = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const pagination = getListParams(request)
    const where = { ...getSchoolFilter(session), status: 'PROSPECT' as const }

    const [prospects, total] = await Promise.all([
      prisma.admission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.admission.count({ where }),
    ])

    return paginatedResponse(prospects.map(prospectToClient), total, pagination)
  },
  { requireAuth: true, module: 'admissions' }
)

export const POST = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return errorResponse('Invalid request body')
    }

    const result = await createAdmission(session, body, {
      status: 'PROSPECT',
      meta: {
        source: PROSPECT_SOURCES.includes(body.source) ? body.source : 'OTHER',
        prospectStatus: PROSPECT_STATUSES.includes(body.status) ? body.status : 'NEW',
      },
    })
    if (result.errors) {
      return validationErrorResponse(result.errors)
    }

    return successResponse(prospectToClient(result.admission), 201)
  },
  { requireAuth: true, module: 'admissions' }
)
