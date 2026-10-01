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
  getSearchParams,
  getSchoolFilter,
  AuthenticatedSession,
} from '@/lib/api-utils'
import { guardianSchema } from '@/lib/validations'
import { Prisma } from '@prisma/client'

export const GET = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const pagination = getPaginationParams(request)
    const searchParams = getSearchParams(request)
    const schoolFilter = getSchoolFilter(session)
    const { searchParams: urlParams } = new URL(request.url)
    const studentId = urlParams.get('studentId')

    const where: Prisma.GuardianWhereInput = {
      ...(studentId && { studentId }),
      ...(schoolFilter.schoolId && {
        student: { schoolId: schoolFilter.schoolId },
      }),
      ...(searchParams.search && {
        OR: [
          { firstName: { contains: searchParams.search, mode: 'insensitive' } },
          { lastName: { contains: searchParams.search, mode: 'insensitive' } },
          { phone: { contains: searchParams.search, mode: 'insensitive' } },
          { email: { contains: searchParams.search, mode: 'insensitive' } },
        ],
      }),
    }

    const [guardians, total] = await Promise.all([
      prisma.guardian.findMany({
        where,
        include: {
          student: {
            select: { id: true, firstName: true, lastName: true, rollNumber: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.guardian.count({ where }),
    ])

    return paginatedResponse(guardians, total, pagination)
  },
  { requireAuth: true, module: 'students' }
)

export const POST = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const { data, errors } = await validateBody(request, guardianSchema)

    if (errors) {
      return validationErrorResponse(errors)
    }

    if (!data) {
      return errorResponse('Invalid request body')
    }

    // Verify student exists and belongs to user's school
    const schoolFilter = getSchoolFilter(session)
    const student = await prisma.student.findFirst({
      where: {
        id: data.studentId,
        ...(schoolFilter.schoolId && { schoolId: schoolFilter.schoolId }),
      },
    })

    if (!student) {
      return validationErrorResponse({ studentId: ['Student not found'] })
    }

    const guardian = await prisma.guardian.create({
      data: {
        studentId: data.studentId,
        relation: data.relation,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        email: data.email,
        occupation: data.occupation,
        address: data.address,
        isPrimary: data.isPrimary,
      },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, rollNumber: true },
        },
      },
    })

    return successResponse(guardian, 201)
  },
  { requireAuth: true, module: 'students' }
)
