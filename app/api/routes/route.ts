import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  successResponse,
  errorResponse,
  validationErrorResponse,
  getPaginationParams,
  paginatedResponse,
  getSearchParams,
  getSchoolFilter,
  AuthenticatedSession,
} from '@/lib/api-utils'
import { routeSchema } from '@/lib/validations'
import { resolveSchoolId } from '@/lib/school-scope'
import { readJson, parseWith, str } from '@/lib/form-body'
import { Prisma } from '@prisma/client'

export const GET = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const pagination = getPaginationParams(request)
    const searchParams = getSearchParams(request)
    const schoolFilter = getSchoolFilter(session)

    const where: Prisma.RouteWhereInput = {
      ...schoolFilter,
      ...(searchParams.search && {
        OR: [
          { name: { contains: searchParams.search, mode: 'insensitive' } },
          { description: { contains: searchParams.search, mode: 'insensitive' } },
        ],
      }),
      ...(searchParams.isActive !== undefined && { isActive: searchParams.isActive === 'true' }),
    }

    const [routes, total] = await Promise.all([
      prisma.route.findMany({
        where,
        include: {
          school: { select: { id: true, name: true } },
          stops: {
            select: { id: true, name: true, arrivalTime: true, sequence: true, fare: true },
            orderBy: { sequence: 'asc' },
          },
          vehicles: {
            select: { id: true, registrationNo: true, capacity: true },
          },
          _count: { select: { stops: true, vehicles: true, students: true } },
        },
        orderBy: { name: 'asc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.route.count({ where }),
    ])

    return paginatedResponse(routes, total, pagination)
  },
  { requireAuth: true, module: 'transport' }
)

export const POST = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const body = await readJson(request)

    // The form may send an empty schoolId; always resolve it from the session.
    const schoolId = await resolveSchoolId(session, body.schoolId)
    if (!schoolId) {
      return errorResponse('School ID is required')
    }

    const { data, errors } = parseWith(routeSchema, {
      ...body,
      schoolId,
      name: str(body.name) ?? '',
      code: str(body.code) ?? '',
      description: str(body.description),
    })

    if (errors) {
      return validationErrorResponse(errors)
    }

    // Route code is unique per school; name is kept unique as well
    const existingRoute = await prisma.route.findFirst({
      where: {
        schoolId,
        OR: [{ code: data.code }, { name: data.name }],
      },
    })

    if (existingRoute) {
      return existingRoute.code === data.code
        ? errorResponse('A route with this code already exists')
        : errorResponse('A route with this name already exists')
    }

    const route = await prisma.route.create({
      data: {
        schoolId,
        name: data.name,
        code: data.code,
        description: data.description,
        isActive: data.isActive,
      },
      include: {
        school: { select: { id: true, name: true } },
        _count: { select: { stops: true, vehicles: true, students: true } },
      },
    })

    return successResponse(route, 201)
  },
  { requireAuth: true, module: 'transport' }
)
