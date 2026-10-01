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
import { hostelFloorSchema } from '@/lib/validations'
import { Prisma } from '@prisma/client'

export const GET = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const pagination = getPaginationParams(request)
    const schoolFilter = getSchoolFilter(session)
    const { searchParams } = new URL(request.url)
    const hostelId = searchParams.get('hostelId')

    const where: Prisma.HostelFloorWhereInput = {
      ...(hostelId && { hostelId }),
      ...(schoolFilter.schoolId && {
        hostel: { schoolId: schoolFilter.schoolId },
      }),
    }

    const [floors, total] = await Promise.all([
      prisma.hostelFloor.findMany({
        where,
        include: {
          hostel: { select: { id: true, name: true } },
          _count: { select: { rooms: true } },
        },
        orderBy: { number: 'asc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.hostelFloor.count({ where }),
    ])

    return paginatedResponse(floors, total, pagination)
  },
  { requireAuth: true, module: 'hostel' }
)

export const POST = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const { data, errors } = await validateBody(request, hostelFloorSchema)

    if (errors) {
      return validationErrorResponse(errors)
    }

    if (!data) {
      return errorResponse('Invalid request body')
    }

    // Verify hostel exists and belongs to user's school
    const schoolFilter = getSchoolFilter(session)
    const hostel = await prisma.hostel.findFirst({
      where: {
        id: data.hostelId,
        ...(schoolFilter.schoolId && { schoolId: schoolFilter.schoolId }),
      },
    })

    if (!hostel) {
      return validationErrorResponse({ hostelId: ['Hostel not found'] })
    }

    const floor = await prisma.hostelFloor.create({
      data: {
        hostelId: data.hostelId,
        name: data.name,
        number: data.number,
        isActive: data.isActive,
      },
      include: {
        hostel: { select: { id: true, name: true } },
      },
    })

    return successResponse(floor, 201)
  },
  { requireAuth: true, module: 'hostel' }
)
