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
import { payrollSchema } from '@/lib/validations'
import { Prisma } from '@prisma/client'

export const GET = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const pagination = getPaginationParams(request)
    const schoolFilter = getSchoolFilter(session)
    const { searchParams } = new URL(request.url)
    const staffId = searchParams.get('staffId')
    const month = searchParams.get('month')
    const year = searchParams.get('year')
    const isPaid = searchParams.get('isPaid')

    const where: Prisma.PayrollWhereInput = {
      ...(staffId && { staffId }),
      ...(month && { month }),
      ...(year && { year: parseInt(year) }),
      ...(isPaid !== null && { isPaid: isPaid === 'true' }),
      ...(schoolFilter.schoolId && { staff: { schoolId: schoolFilter.schoolId } }),
    }

    const [payrolls, total] = await Promise.all([
      prisma.payroll.findMany({
        where,
        include: {
          staff: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeId: true,
              department: true,
              designation: true,
            },
          },
        },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.payroll.count({ where }),
    ])

    return paginatedResponse(payrolls, total, pagination)
  },
  { requireAuth: true, module: 'staff' }
)

export const POST = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const { data, errors } = await validateBody(request, payrollSchema)

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

    // Check for duplicate payroll entry
    const existing = await prisma.payroll.findFirst({
      where: {
        staffId: data.staffId,
        month: data.month,
        year: data.year,
      },
    })

    if (existing) {
      return validationErrorResponse({
        month: ['Payroll entry already exists for this month and year'],
      })
    }

    const payroll = await prisma.payroll.create({
      data: {
        staffId: data.staffId,
        month: data.month,
        year: data.year,
        basicSalary: data.basicSalary,
        allowances: data.allowances as Prisma.InputJsonValue | undefined,
        deductions: data.deductions as Prisma.InputJsonValue | undefined,
        netSalary: data.netSalary,
        paymentDate: data.paymentDate ? new Date(data.paymentDate) : null,
        paymentMode: data.paymentMode,
        isPaid: data.isPaid ?? false,
      },
      include: {
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            department: true,
            designation: true,
          },
        },
      },
    })

    return successResponse(payroll, 201)
  },
  { requireAuth: true, module: 'staff' }
)
