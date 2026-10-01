import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
} from '@/lib/api-utils'
import { schoolWhere } from '@/lib/school-scope'
import { readJson } from '@/lib/form-body'
import { checkVehicleRefs, parseVehicleUpdate, toPageVehicle, vehicleInclude } from '../shared'

// GET /api/transport/vehicles/[id]
export const GET = withApiHandler(
  async (_request: NextRequest, { params }, session) => {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: params.id, ...schoolWhere(session) },
      include: vehicleInclude,
    })

    if (!vehicle) {
      return notFoundResponse('Vehicle not found')
    }

    return successResponse(toPageVehicle(vehicle))
  },
  { requireAuth: true, module: 'transport' }
)

// PUT /api/transport/vehicles/[id]
export const PUT = withApiHandler(
  async (request: NextRequest, { params }, session) => {
    const existing = await prisma.vehicle.findFirst({
      where: { id: params.id, ...schoolWhere(session) },
    })

    if (!existing) {
      return notFoundResponse('Vehicle not found')
    }

    const { data, errors } = parseVehicleUpdate(await readJson(request))
    if (errors) {
      return validationErrorResponse(errors)
    }

    const refError = await checkVehicleRefs(existing.schoolId, data, existing.id)
    if (refError) {
      return errorResponse(refError)
    }

    const vehicle = await prisma.vehicle.update({
      where: { id: existing.id },
      data,
      include: vehicleInclude,
    })

    return successResponse(toPageVehicle(vehicle))
  },
  { requireAuth: true, module: 'transport' }
)

// DELETE /api/transport/vehicles/[id]
// GPS tracking rows and transport alerts cascade with the vehicle.
export const DELETE = withApiHandler(
  async (_request: NextRequest, { params }, session) => {
    const existing = await prisma.vehicle.findFirst({
      where: { id: params.id, ...schoolWhere(session) },
      select: { id: true },
    })

    if (!existing) {
      return notFoundResponse('Vehicle not found')
    }

    await prisma.vehicle.delete({ where: { id: existing.id } })

    return successResponse({ message: 'Vehicle deleted successfully' })
  },
  { requireAuth: true, module: 'transport' }
)
