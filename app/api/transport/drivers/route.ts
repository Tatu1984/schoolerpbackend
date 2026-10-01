import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withApiHandler, successResponse, errorResponse } from '@/lib/api-utils'
import { schoolWhere, resolveSchoolId, parseDate, parseNumber } from '@/lib/school-scope'

// GET /api/transport/drivers
export const GET = withApiHandler(
  async (_request: NextRequest, _context, session) => {
    const drivers = await prisma.driver.findMany({
      where: schoolWhere(session),
      orderBy: { createdAt: 'desc' },
    })
    return successResponse(drivers)
  },
  { requireAuth: true, module: 'transport' }
)

// POST /api/transport/drivers
export const POST = withApiHandler(
  async (request: NextRequest, _context, session) => {
    const body = await request.json().catch(() => null)
    if (!body) return errorResponse('Invalid request body')

    const name = String(body.name || '').trim()
    const phone = String(body.phone || '').trim()
    const licenseNumber = String(body.licenseNumber || '').trim()
    if (!name) return errorResponse('Driver name is required')
    if (!phone) return errorResponse('Phone is required')
    if (!licenseNumber) return errorResponse('License number is required')

    const licenseExpiry = parseDate(body.licenseExpiry)
    if (licenseExpiry === undefined) return errorResponse('Invalid license expiry date')

    const schoolId = await resolveSchoolId(session, body.schoolId)
    if (!schoolId) return errorResponse('No school associated with this account')

    const experience = parseNumber(body.experience)

    const driver = await prisma.driver.create({
      data: {
        schoolId,
        name,
        phone,
        licenseNumber,
        licenseExpiry,
        experience: experience === null ? null : Math.round(experience),
        status: body.status ? String(body.status) : 'ACTIVE',
      },
    })

    return successResponse(driver, 201)
  },
  { requireAuth: true, module: 'transport' }
)
