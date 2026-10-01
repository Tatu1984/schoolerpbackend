import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  successResponse,
  errorResponse,
  validationErrorResponse,
  getPaginationParams,
  paginatedResponse,
} from '@/lib/api-utils'
import { schoolWhere, resolveSchoolId } from '@/lib/school-scope'
import { readJson } from '@/lib/form-body'
import { checkVehicleRefs, parseVehicleCreate, toPageVehicle, vehicleInclude } from './shared'

// GET /api/transport/vehicles - full list for the vehicles page.
// Pass ?page= or ?limit= to paginate.
export const GET = withApiHandler(
  async (request: NextRequest, _context, session) => {
    const where = schoolWhere(session)
    const { searchParams } = new URL(request.url)

    if (searchParams.has('page') || searchParams.has('limit')) {
      const pagination = getPaginationParams(request)
      const [vehicles, total] = await Promise.all([
        prisma.vehicle.findMany({
          where,
          include: vehicleInclude,
          orderBy: { createdAt: 'desc' },
          skip: pagination.skip,
          take: pagination.limit,
        }),
        prisma.vehicle.count({ where }),
      ])
      return paginatedResponse(vehicles.map(toPageVehicle), total, pagination)
    }

    const vehicles = await prisma.vehicle.findMany({
      where,
      include: vehicleInclude,
      orderBy: { createdAt: 'desc' },
    })

    return successResponse(vehicles.map(toPageVehicle))
  },
  { requireAuth: true, module: 'transport' }
)

// POST /api/transport/vehicles
export const POST = withApiHandler(
  async (request: NextRequest, _context, session) => {
    const body = await readJson(request)

    const schoolId = await resolveSchoolId(session, body.schoolId)
    if (!schoolId) {
      return errorResponse('School ID is required')
    }

    const { data, errors } = parseVehicleCreate(body, schoolId)
    if (errors) {
      return validationErrorResponse(errors)
    }

    const refError = await checkVehicleRefs(schoolId, data)
    if (refError) {
      return errorResponse(refError)
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
      include: vehicleInclude,
    })

    return successResponse(toPageVehicle(vehicle), 201)
  },
  { requireAuth: true, module: 'transport' }
)
