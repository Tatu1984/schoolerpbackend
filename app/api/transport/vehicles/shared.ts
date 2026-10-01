import prisma from '@/lib/prisma'
import { vehicleSchema } from '@/lib/validations'
import { FormBody, num, parseWith, str } from '@/lib/form-body'

// The transport/vehicles page uses its own field names. The Vehicle model has
// no model/year/status columns: status is derived from isActive, model/year
// are accepted but not persisted.
type VehicleRow = {
  id: string
  number: string
  registrationNo: string | null
  isActive: boolean
}

export const vehicleInclude = {
  route: { select: { id: true, name: true, code: true } },
} as const

export function toPageVehicle<T extends VehicleRow>(vehicle: T) {
  return {
    ...vehicle,
    vehicleNumber: vehicle.number,
    registrationNumber: vehicle.registrationNo ?? '',
    model: '',
    year: '',
    status: vehicle.isActive ? 'ACTIVE' : 'MAINTENANCE',
  }
}

/** Map page field names (vehicleNumber, registrationNumber, status) onto vehicleSchema input. */
export function normalizeVehicleBody(body: FormBody): FormBody {
  const out: FormBody = {}
  const number = body.vehicleNumber ?? body.number
  if (number !== undefined) out.number = str(number) ?? ''
  if (body.type !== undefined) out.type = str(body.type) ?? ''
  if (body.capacity !== undefined) out.capacity = num(body.capacity)
  const registration = body.registrationNumber ?? body.registrationNo
  if (registration !== undefined) out.registrationNo = str(registration)
  if (body.routeId !== undefined) out.routeId = str(body.routeId)
  if (body.driverName !== undefined) out.driverName = str(body.driverName)
  if (body.driverPhone !== undefined) out.driverPhone = str(body.driverPhone)
  if (body.driverLicense !== undefined) out.driverLicense = str(body.driverLicense)
  if (body.insurance !== undefined) out.insurance = str(body.insurance)
  if (typeof body.isActive === 'boolean') out.isActive = body.isActive
  else if (typeof body.status === 'string' && body.status) out.isActive = body.status === 'ACTIVE'
  return out
}

const vehicleUpdateSchema = vehicleSchema.partial().omit({ schoolId: true })

export function parseVehicleCreate(body: FormBody, schoolId: string) {
  return parseWith(vehicleSchema, { ...normalizeVehicleBody(body), schoolId })
}

export function parseVehicleUpdate(body: FormBody) {
  return parseWith(vehicleUpdateSchema, normalizeVehicleBody(body))
}

/** Returns an error message when number/route are not valid for the school, else null. */
export async function checkVehicleRefs(
  schoolId: string,
  data: { number?: string; routeId?: string | null },
  excludeId?: string
): Promise<string | null> {
  if (data.number) {
    const duplicate = await prisma.vehicle.findFirst({
      where: { schoolId, number: data.number, ...(excludeId && { id: { not: excludeId } }) },
      select: { id: true },
    })
    if (duplicate) return 'A vehicle with this number already exists'
  }
  if (data.routeId) {
    const route = await prisma.route.findFirst({
      where: { id: data.routeId, schoolId },
      select: { id: true },
    })
    if (!route) return 'Invalid route for this school'
  }
  return null
}
