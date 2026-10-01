import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  successResponse,
  validationErrorResponse,
  validateBody,
  AuthenticatedSession,
} from '@/lib/api-utils'
import { vehicleTrackingSchema } from '@/lib/validations'
import { schoolWhere } from '@/lib/school-scope'

// Minutes after which a vehicle without a fresh GPS ping is considered stopped
const STALE_MINUTES = 10

// GET /api/transport/tracking - one entry per vehicle with its latest GPS position,
// shaped for the tracking page. `totalDistance` is null: route distance is not stored.
export const GET = withApiHandler(
  async (_request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const vehicles = await prisma.vehicle.findMany({
      where: { ...schoolWhere(session), isActive: true },
      include: {
        route: {
          select: {
            id: true,
            name: true,
            code: true,
            stops: { select: { name: true, sequence: true }, orderBy: { sequence: 'asc' } },
          },
        },
      },
      orderBy: { number: 'asc' },
    })

    const latestPoints = vehicles.length
      ? await prisma.gPSTracking.findMany({
          where: { vehicleId: { in: vehicles.map((v) => v.id) } },
          orderBy: { timestamp: 'desc' },
          distinct: ['vehicleId'],
        })
      : []
    const latestByVehicle = new Map(latestPoints.map((point) => [point.vehicleId, point]))

    const now = Date.now()
    const data = vehicles.map((vehicle) => {
      const point = latestByVehicle.get(vehicle.id)
      const speed = point?.speed ?? 0
      const isFresh = !!point && now - point.timestamp.getTime() <= STALE_MINUTES * 60 * 1000
      const status = !isFresh ? 'STOPPED' : speed > 0 ? 'MOVING' : 'IDLE'
      const stops = vehicle.route?.stops ?? []

      return {
        id: vehicle.id,
        vehicleId: vehicle.id,
        vehicleNumber: vehicle.number,
        type: vehicle.type,
        status,
        speed,
        latitude: point?.latitude ?? null,
        longitude: point?.longitude ?? null,
        currentLocation: point
          ? `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`
          : 'No GPS data yet',
        lastUpdate: point?.timestamp ?? null,
        driver: vehicle.driverName,
        driverPhone: vehicle.driverPhone,
        routeName: vehicle.route?.name ?? null,
        routeStart: stops[0]?.name ?? null,
        routeEnd: stops.length > 1 ? stops[stops.length - 1].name : null,
        totalDistance: null,
      }
    })

    return successResponse(data)
  },
  { requireAuth: true, module: 'transport' }
)

export const POST = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const { data, errors } = await validateBody(request, vehicleTrackingSchema)

    if (errors) {
      return validationErrorResponse(errors)
    }

    // The vehicle must belong to the caller's school
    const ownedVehicle = await prisma.vehicle.findFirst({
      where: { id: data!.vehicleId, ...schoolWhere(session) },
      select: { id: true },
    })
    if (!ownedVehicle) {
      return validationErrorResponse({ vehicleId: ['Vehicle not found'] })
    }

    const trackingData = {
      vehicleId: data!.vehicleId,
      latitude: parseFloat(data!.latitude.toString()),
      longitude: parseFloat(data!.longitude.toString()),
      speed: data!.speed ? parseFloat(data!.speed.toString()) : null,
      timestamp: data!.timestamp ? new Date(data!.timestamp) : new Date(),
    }

    const tracking = await prisma.gPSTracking.create({
      data: trackingData,
      include: {
        vehicle: {
          include: {
            route: true,
          },
        },
      },
    })

    return successResponse(tracking, 201)
  },
  { requireAuth: true, module: 'transport' }
)
