import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  getSchoolFilter,
  successResponse,
  hasMinimumRole,
  errorResponse,
  notFoundResponse,
  AuthenticatedSession
} from '@/lib/api-utils'
import { logAudit } from '@/lib/audit'

export const GET = withApiHandler(
  async (request: NextRequest, context, session: AuthenticatedSession | null) => {
    // Role check
    if (!session || !hasMinimumRole(session.user.role, 'SCHOOL_ADMIN')) {
      return errorResponse('Access denied', 403)
    }

    const { id } = context.params

    // Apply school filter
    const schoolFilter = getSchoolFilter(session)

    // Fetch the compliance record
    const complianceRecord = await prisma.complianceRecord.findFirst({
      where: {
        id,
        ...schoolFilter
      }
    }).catch(() => null)

    if (!complianceRecord) {
      return notFoundResponse('Compliance record not found')
    }

    return successResponse(complianceRecord)
  },
  { requireAuth: true, module: 'security' }
)

export const PUT = withApiHandler(
  async (request: NextRequest, context, session: AuthenticatedSession | null) => {
    // Role check
    if (!session || !hasMinimumRole(session.user.role, 'SCHOOL_ADMIN')) {
      return errorResponse('Access denied', 403)
    }

    const { id } = context.params

    let body
    try {
      body = await request.json()
    } catch {
      return errorResponse('Invalid JSON in request body', 400)
    }

    const { complianceType, description, validFrom, validUntil, isActive } = body

    // The checklist toggles send a boolean (`status: true` / `completed: true`);
    // the column is a string, so map it to COMPLIANT / PENDING.
    let status: string | undefined
    const rawStatus = body.completed !== undefined ? body.completed : body.status
    if (typeof rawStatus === 'boolean') status = rawStatus ? 'COMPLIANT' : 'PENDING'
    else if (typeof rawStatus === 'string' && rawStatus) status = rawStatus

    // Apply school filter
    const schoolFilter = getSchoolFilter(session)

    // Verify the compliance record exists and belongs to the user's school
    const existingRecord = await prisma.complianceRecord.findFirst({
      where: {
        id,
        ...schoolFilter
      }
    }).catch(() => null)

    if (!existingRecord) {
      return notFoundResponse('Compliance record not found')
    }

    if (validFrom !== undefined && (!validFrom || isNaN(new Date(validFrom).getTime()))) {
      return errorResponse('Invalid validFrom date', 400)
    }
    if (validUntil && isNaN(new Date(validUntil).getTime())) {
      return errorResponse('Invalid validUntil date', 400)
    }

    // Update the compliance record
    const updateData: Record<string, unknown> = {}
    if (complianceType !== undefined) updateData.complianceType = complianceType
    if (description !== undefined) updateData.description = description
    if (status !== undefined) updateData.status = status
    if (validFrom !== undefined) updateData.validFrom = new Date(validFrom)
    if (validUntil !== undefined) updateData.validUntil = validUntil ? new Date(validUntil) : null
    if (isActive !== undefined) updateData.isActive = isActive

    const updatedRecord = await prisma.complianceRecord.update({
      where: { id },
      data: updateData
    })

    await logAudit(session, request, 'UPDATE', 'ComplianceRecord', id, updateData)

    return successResponse(updatedRecord)
  },
  { requireAuth: true, module: 'security' }
)

export const DELETE = withApiHandler(
  async (request: NextRequest, context, session: AuthenticatedSession | null) => {
    // Role check
    if (!session || !hasMinimumRole(session.user.role, 'SCHOOL_ADMIN')) {
      return errorResponse('Access denied', 403)
    }

    const { id } = context.params

    // Apply school filter
    const schoolFilter = getSchoolFilter(session)

    // Verify the compliance record exists and belongs to the user's school
    const existingRecord = await prisma.complianceRecord.findFirst({
      where: {
        id,
        ...schoolFilter
      }
    }).catch(() => null)

    if (!existingRecord) {
      return notFoundResponse('Compliance record not found')
    }

    // Delete the compliance record
    await prisma.complianceRecord.delete({
      where: { id }
    })

    await logAudit(session, request, 'DELETE', 'ComplianceRecord', id, {
      complianceType: existingRecord.complianceType,
    })

    return successResponse({ message: 'Compliance record deleted successfully' })
  },
  { requireAuth: true, module: 'security' }
)
