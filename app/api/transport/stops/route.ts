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
import { stopSchema } from '@/lib/validations'
import { Prisma } from '@prisma/client'

export const GET = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const pagination = getPaginationParams(request)
    const schoolFilter = getSchoolFilter(session)
    const { searchParams } = new URL(request.url)
    const routeId = searchParams.get('routeId')

    const where: Prisma.StopWhereInput = {
      ...(routeId && { routeId }),
      ...(schoolFilter.schoolId && { route: { schoolId: schoolFilter.schoolId } }),
    }

    const [stops, total] = await Promise.all([
      prisma.stop.findMany({
        where,
        include: {
          route: { select: { id: true, name: true, code: true } },
        },
        orderBy: { sequence: 'asc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.stop.count({ where }),
    ])

    return paginatedResponse(stops, total, pagination)
  },
  { requireAuth: true, module: 'transport' }
)

export const POST = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const { data, errors } = await validateBody(request, stopSchema)

    if (errors) {
      return validationErrorResponse(errors)
    }

    if (!data) {
      return errorResponse('Invalid request body')
    }

    // Verify route exists and belongs to user's school
    const schoolFilter = getSchoolFilter(session)
    const route = await prisma.route.findFirst({
      where: {
        id: data.routeId,
        ...(schoolFilter.schoolId && { schoolId: schoolFilter.schoolId }),
      },
    })

    if (!route) {
      return validationErrorResponse({ routeId: ['Route not found'] })
    }

    const stop = await prisma.stop.create({
      data: {
        routeId: data.routeId,
        name: data.name,
        location: data.location,
        arrivalTime: data.arrivalTime,
        sequence: data.sequence ?? 0,
        fare: data.fare ?? 0,
        isActive: data.isActive ?? true,
      },
      include: {
        route: { select: { id: true, name: true, code: true } },
      },
    })

    return successResponse(stop, 201)
  },
  { requireAuth: true, module: 'transport' }
)
