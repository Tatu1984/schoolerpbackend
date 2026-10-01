import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  getSchoolFilter,
  successResponse,
  validationErrorResponse,
  validateBody,
  notFoundResponse,
} from '@/lib/api-utils'
import { vehicleSchema } from '@/lib/validations'

export const PUT = withApiHandler(
  async (request: NextRequest, context, session) => {
    const { id } = context.params
    const schoolFilter = getSchoolFilter(session)

    // Check if vehicle exists and belongs to user's school
    const existingVehicle = await prisma.vehicle.findFirst({
      where: {
        id,
        ...schoolFilter,
      },
    })

    if (!existingVehicle) {
      return notFoundResponse('Vehicle not found')
    }

    const { data, errors } = await validateBody(request, vehicleSchema.partial())

    if (errors) {
      return validationErrorResponse(errors)
    }

    const updateData: Record<string, unknown> = {}
    if (data?.number !== undefined) updateData.number = data.number
    if (data?.type !== undefined) updateData.type = data.type
    if (data?.capacity !== undefined) updateData.capacity = data.capacity
    if (data?.routeId !== undefined) updateData.routeId = data.routeId
    if (data?.driverName !== undefined) updateData.driverName = data.driverName
    if (data?.driverPhone !== undefined) updateData.driverPhone = data.driverPhone
    if (data?.driverLicense !== undefined) updateData.driverLicense = data.driverLicense
    if (data?.registrationNo !== undefined) updateData.registrationNo = data.registrationNo
    if (data?.insurance !== undefined) updateData.insurance = data.insurance
    if (data?.isActive !== undefined) updateData.isActive = data.isActive

    const vehicle = await prisma.vehicle.update({
      where: { id },
      data: updateData,
      include: {
        route: true,
      },
    })

    return successResponse(vehicle)
  },
  { requireAuth: true, module: 'transport' }
)

export const DELETE = withApiHandler(
  async (_request: NextRequest, context, session) => {
    const { id } = context.params
    const schoolFilter = getSchoolFilter(session)

    // Check if vehicle exists and belongs to user's school
    const existingVehicle = await prisma.vehicle.findFirst({
      where: {
        id,
        ...schoolFilter,
      },
    })

    if (!existingVehicle) {
      return notFoundResponse('Vehicle not found')
    }

    await prisma.vehicle.delete({
      where: { id },
    })

    return successResponse({ message: 'Vehicle deleted successfully' })
  },
  { requireAuth: true, module: 'transport' }
)
