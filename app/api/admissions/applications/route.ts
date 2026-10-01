import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import {
  withApiHandler,
  getSchoolFilter,
  paginatedResponse,
  successResponse,
  errorResponse,
  validationErrorResponse,
  AuthenticatedSession,
} from '@/lib/api-utils'
import { applicationToClient, createAdmission, getListParams } from '../helpers'

export const GET = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const pagination = getListParams(request)

    // Everything past the inquiry stage is an application, including decided
    // ones - the page shows approved/rejected/waitlisted counts.
    const where: Prisma.AdmissionWhereInput = {
      ...getSchoolFilter(session),
      status: { notIn: ['INQUIRY', 'CANCELLED'] },
    }

    const [applications, total] = await Promise.all([
      prisma.admission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.admission.count({ where }),
    ])

    return paginatedResponse(applications.map(applicationToClient), total, pagination)
  },
  { requireAuth: true, module: 'admissions' }
)

export const POST = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return errorResponse('Invalid request body')
    }

    const result = await createAdmission(session, body, { status: 'PROSPECT' })
    if (result.errors) {
      return validationErrorResponse(result.errors)
    }

    return successResponse(applicationToClient(result.admission), 201)
  },
  { requireAuth: true, module: 'admissions' }
)
