import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withApiHandler, successResponse, errorResponse, notFoundResponse } from '@/lib/api-utils'
import { schoolWhere, parseDate, parseNumber } from '@/lib/school-scope'

// GET /api/transport/drivers/[id]
export const GET = withApiHandler(
  async (_request: NextRequest, { params }, session) => {
    const driver = await prisma.driver.findFirst({
      where: { id: params.id, ...schoolWhere(session) },
    })
    if (!driver) return notFoundResponse('Driver not found')
    return successResponse(driver)
  },
  { requireAuth: true, module: 'transport' }
)

// PUT /api/transport/drivers/[id]
export const PUT = withApiHandler(
  async (request: NextRequest, { params }, session) => {
    const body = await request.json().catch(() => null)
    if (!body) return errorResponse('Invalid request body')

    const existing = await prisma.driver.findFirst({
      where: { id: params.id, ...schoolWhere(session) },
      select: { id: true },
    })
    if (!existing) return notFoundResponse('Driver not found')

    const data: {
      name?: string
      phone?: string
      licenseNumber?: string
      licenseExpiry?: Date | null
      experience?: number | null
      status?: string
    } = {}

    if (body.name !== undefined) {
      const name = String(body.name).trim()
      if (!name) return errorResponse('Driver name is required')
      data.name = name
    }
    if (body.phone !== undefined) {
      const phone = String(body.phone).trim()
      if (!phone) return errorResponse('Phone is required')
      data.phone = phone
    }
    if (body.licenseNumber !== undefined) {
      const licenseNumber = String(body.licenseNumber).trim()
      if (!licenseNumber) return errorResponse('License number is required')
      data.licenseNumber = licenseNumber
    }
    if (body.licenseExpiry !== undefined) {
      const licenseExpiry = parseDate(body.licenseExpiry)
      if (licenseExpiry === undefined) return errorResponse('Invalid license expiry date')
      data.licenseExpiry = licenseExpiry
    }
    if (body.experience !== undefined) {
      const experience = parseNumber(body.experience)
      data.experience = experience === null ? null : Math.round(experience)
    }
    if (body.status) data.status = String(body.status)

    const driver = await prisma.driver.update({ where: { id: existing.id }, data })
    return successResponse(driver)
  },
  { requireAuth: true, module: 'transport' }
)

// DELETE /api/transport/drivers/[id]
export const DELETE = withApiHandler(
  async (_request: NextRequest, { params }, session) => {
    const existing = await prisma.driver.findFirst({
      where: { id: params.id, ...schoolWhere(session) },
      select: { id: true },
    })
    if (!existing) return notFoundResponse('Driver not found')

    await prisma.driver.delete({ where: { id: existing.id } })
    return successResponse({ id: existing.id })
  },
  { requireAuth: true, module: 'transport' }
)
