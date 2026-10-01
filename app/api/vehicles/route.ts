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
  getSearchParams,
  getSchoolFilter,
  AuthenticatedSession,
} from '@/lib/api-utils'
import { vehicleSchema } from '@/lib/validations'
import { Prisma } from '@prisma/client'

export const GET = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const pagination = getPaginationParams(request)
    const searchParams = getSearchParams(request)
    const schoolFilter = getSchoolFilter(session)

    const where: Prisma.VehicleWhereInput = {
      ...schoolFilter,
      ...(searchParams.search && {
        OR: [
          { number: { contains: searchParams.search, mode: 'insensitive' } },
          { registrationNo: { contains: searchParams.search, mode: 'insensitive' } },
          { driverName: { contains: searchParams.search, mode: 'insensitive' } },
        ],
      }),
      ...(searchParams.routeId && { routeId: searchParams.routeId }),
      ...(searchParams.isActive !== undefined && { isActive: searchParams.isActive === 'true' }),
    }

    const [vehicles, total] = await Promise.all([
      prisma.vehicle.findMany({
        where,
        include: {
          school: { select: { id: true, name: true } },
          route: { select: { id: true, name: true } },
        },
        orderBy: { number: 'asc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.vehicle.count({ where }),
    ])

    return paginatedResponse(vehicles, total, pagination)
  },
  { requireAuth: true, module: 'transport' }
)

export const POST = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const { data, errors } = await validateBody(request, vehicleSchema)

    if (errors) {
      return validationErrorResponse(errors)
    }

    if (!data) {
      return errorResponse('Invalid request body')
    }

    const schoolId = data.schoolId || session?.user.schoolId
    if (!schoolId) {
      return errorResponse('School ID is required')
    }

    // Check for duplicate registration number
    const existingVehicle = await prisma.vehicle.findFirst({
      where: {
        registrationNo: data.registrationNo,
      },
    })

    if (existingVehicle) {
      return validationErrorResponse({
        registrationNo: ['Vehicle with this registration number already exists'],
      })
    }

    // Verify route belongs to school if provided
    if (data.routeId) {
      const route = await prisma.route.findFirst({
        where: {
          id: data.routeId,
          schoolId,
        },
      })

      if (!route) {
        return validationErrorResponse({
          routeId: ['Invalid route for this school'],
        })
      }
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        schoolId,
        number: data.number,
        type: data.type,
        capacity: data.capacity,
        routeId: data.routeId,
        driverName: data.driverName,
        driverPhone: data.driverPhone,
        driverLicense: data.driverLicense,
        registrationNo: data.registrationNo,
        insurance: data.insurance,
        isActive: data.isActive,
      },
      include: {
        school: { select: { id: true, name: true } },
        route: { select: { id: true, name: true } },
      },
    })

    return successResponse(vehicle, 201)
  },
  { requireAuth: true, module: 'transport' }
)
