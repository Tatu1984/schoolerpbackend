import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { LeaveStatus } from '@prisma/client'
import { withApiHandler, successResponse, errorResponse, notFoundResponse } from '@/lib/api-utils'
import { schoolWhere, parseDate } from '@/lib/school-scope'

const staffSelect = {
  id: true,
  firstName: true,
  lastName: true,
  employeeId: true,
  department: true,
  designation: true,
} as const

// PUT /api/staff/leave/[id] - approve / reject / edit a leave request
export const PUT = withApiHandler(
  async (request: NextRequest, { params }, session) => {
    const body = await request.json().catch(() => null)
    if (!body) return errorResponse('Invalid request body')

    const existing = await prisma.leaveRequest.findFirst({
      where: { id: params.id, staff: schoolWhere(session) },
      select: { id: true, status: true },
    })
    if (!existing) return notFoundResponse('Leave request not found')

    const data: {
      status?: LeaveStatus
      approvedBy?: string | null
      approvalDate?: Date | null
      remarks?: string | null
      leaveType?: string
      reason?: string
      startDate?: Date
      endDate?: Date
    } = {}

    if (body.status !== undefined) {
      const status = String(body.status).toUpperCase()
      if (!(status in LeaveStatus)) return errorResponse('Invalid leave status')
      data.status = status as LeaveStatus
      if (status !== existing.status) {
        if (status === 'APPROVED' || status === 'REJECTED') {
          data.approvedBy = session?.user.name || session?.user.email || session?.user.id || null
          data.approvalDate = new Date()
        } else if (status === 'PENDING') {
          data.approvedBy = null
          data.approvalDate = null
        }
      }
    }
    if (body.remarks !== undefined) data.remarks = body.remarks ? String(body.remarks) : null
    if (body.leaveType) data.leaveType = String(body.leaveType)
    if (body.reason) data.reason = String(body.reason)
    if (body.startDate) {
      const d = parseDate(body.startDate)
      if (!d) return errorResponse('Invalid start date')
      data.startDate = d
    }
    if (body.endDate) {
      const d = parseDate(body.endDate)
      if (!d) return errorResponse('Invalid end date')
      data.endDate = d
    }

    const leave = await prisma.leaveRequest.update({
      where: { id: existing.id },
      data,
      include: { staff: { select: staffSelect } },
    })

    return successResponse(leave)
  },
  { requireAuth: true, module: 'staff' }
)

// DELETE /api/staff/leave/[id]
export const DELETE = withApiHandler(
  async (_request: NextRequest, { params }, session) => {
    const existing = await prisma.leaveRequest.findFirst({
      where: { id: params.id, staff: schoolWhere(session) },
      select: { id: true },
    })
    if (!existing) return notFoundResponse('Leave request not found')

    await prisma.leaveRequest.delete({ where: { id: existing.id } })
    return successResponse({ id: existing.id })
  },
  { requireAuth: true, module: 'staff' }
)
