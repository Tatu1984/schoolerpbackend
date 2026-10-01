import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  successResponse,
  errorResponse,
  validationErrorResponse,
  validateBody,
  getPaginationParams,
  paginatedResponse,
  getSchoolFilter,
  AuthenticatedSession,
} from '@/lib/api-utils'
import { leaveRequestSchema } from '@/lib/validations'
import { Prisma } from '@prisma/client'

export const GET = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const pagination = getPaginationParams(request)
    const schoolFilter = getSchoolFilter(session)
    const { searchParams } = new URL(request.url)
    const staffId = searchParams.get('staffId')
    const status = searchParams.get('status')

    const where: Prisma.LeaveRequestWhereInput = {
      ...(staffId && { staffId }),
      ...(status && { status: status as Prisma.EnumLeaveStatusFilter['equals'] }),
      ...(schoolFilter.schoolId && { staff: { schoolId: schoolFilter.schoolId } }),
    }

    const [leaves, total] = await Promise.all([
      prisma.leaveRequest.findMany({
        where,
        include: {
          staff: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeId: true,
              department: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.leaveRequest.count({ where }),
    ])

    return paginatedResponse(leaves, total, pagination)
  },
  { requireAuth: true, module: 'staff' }
)

export const POST = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const { data, errors } = await validateBody(request, leaveRequestSchema)

    if (errors) {
      return validationErrorResponse(errors)
    }

    if (!data) {
      return errorResponse('Invalid request body')
    }

    // Verify staff exists and belongs to user's school
    const schoolFilter = getSchoolFilter(session)
    const staff = await prisma.staff.findFirst({
      where: {
        id: data.staffId,
        ...(schoolFilter.schoolId && { schoolId: schoolFilter.schoolId }),
      },
    })

    if (!staff) {
      return validationErrorResponse({ staffId: ['Staff member not found'] })
    }

    const leave = await prisma.leaveRequest.create({
      data: {
        staffId: data.staffId,
        leaveType: data.leaveType,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        reason: data.reason,
        status: 'PENDING',
      },
      include: {
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            department: true,
          },
        },
      },
    })

    return successResponse(leave, 201)
  },
  { requireAuth: true, module: 'staff' }
)
