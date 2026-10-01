import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withApiHandler, successResponse, errorResponse } from '@/lib/api-utils'
import { schoolWhere, parseDate } from '@/lib/school-scope'

const staffSelect = {
  id: true,
  firstName: true,
  lastName: true,
  employeeId: true,
  department: true,
  designation: true,
} as const

// GET /api/staff/leave - all leave requests for the school (page filters client-side)
export const GET = withApiHandler(
  async (request: NextRequest, _context, session) => {
    const { searchParams } = new URL(request.url)
    const staffId = searchParams.get('staffId')

    const leaves = await prisma.leaveRequest.findMany({
      where: {
        staff: schoolWhere(session),
        ...(staffId && { staffId }),
      },
      include: { staff: { select: staffSelect } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    })

    return successResponse(leaves)
  },
  { requireAuth: true, module: 'staff' }
)

// POST /api/staff/leave - create a leave request
export const POST = withApiHandler(
  async (request: NextRequest, _context, session) => {
    const body = await request.json().catch(() => null)
    if (!body) return errorResponse('Invalid request body')

    const { staffId, leaveType, reason } = body
    const startDate = parseDate(body.startDate)
    const endDate = parseDate(body.endDate)

    if (!staffId) return errorResponse('Staff member is required')
    if (!leaveType) return errorResponse('Leave type is required')
    if (!startDate || !endDate) return errorResponse('Valid start and end dates are required')
    if (endDate < startDate) return errorResponse('End date cannot be before start date')
    if (!reason || !String(reason).trim()) return errorResponse('Reason is required')

    const staff = await prisma.staff.findFirst({
      where: { id: String(staffId), ...schoolWhere(session) },
      select: { id: true },
    })
    if (!staff) return errorResponse('Staff member not found', 404)

    const leave = await prisma.leaveRequest.create({
      data: {
        staffId: staff.id,
        leaveType: String(leaveType),
        startDate,
        endDate,
        reason: String(reason).trim(),
        status: 'PENDING',
      },
      include: { staff: { select: staffSelect } },
    })

    return successResponse(leave, 201)
  },
  { requireAuth: true, module: 'staff' }
)
