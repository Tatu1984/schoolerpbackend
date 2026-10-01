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
import { studentHostelSchema } from '@/lib/validations'
import { Prisma } from '@prisma/client'

export const GET = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const pagination = getPaginationParams(request)
    const schoolFilter = getSchoolFilter(session)
    const { searchParams } = new URL(request.url)
    const hostelId = searchParams.get('hostelId')
    const isActive = searchParams.get('isActive')

    const where: Prisma.StudentHostelWhereInput = {
      ...(hostelId && { hostelId }),
      ...(isActive !== null && { isActive: isActive === 'true' }),
      ...(schoolFilter.schoolId && { hostel: { schoolId: schoolFilter.schoolId } }),
    }

    const [allocations, total] = await Promise.all([
      prisma.studentHostel.findMany({
        where,
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              rollNumber: true,
              class: { select: { name: true } },
            },
          },
          hostel: { select: { id: true, name: true } },
          bed: {
            select: {
              id: true,
              number: true,
              room: {
                select: {
                  number: true,
                  floor: { select: { name: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.studentHostel.count({ where }),
    ])

    return paginatedResponse(allocations, total, pagination)
  },
  { requireAuth: true, module: 'hostel' }
)

export const POST = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const { data, errors } = await validateBody(request, studentHostelSchema)

    if (errors) {
      return validationErrorResponse(errors)
    }

    if (!data) {
      return errorResponse('Invalid request body')
    }

    const schoolFilter = getSchoolFilter(session)

    // Verify student exists and belongs to user's school
    const student = await prisma.student.findFirst({
      where: {
        id: data.studentId,
        ...(schoolFilter.schoolId && { schoolId: schoolFilter.schoolId }),
      },
    })

    if (!student) {
      return validationErrorResponse({ studentId: ['Student not found'] })
    }

    // Verify hostel exists and belongs to user's school
    const hostel = await prisma.hostel.findFirst({
      where: {
        id: data.hostelId,
        ...(schoolFilter.schoolId && { schoolId: schoolFilter.schoolId }),
      },
    })

    if (!hostel) {
      return validationErrorResponse({ hostelId: ['Hostel not found'] })
    }

    // Verify bed exists and is not occupied
    const bed = await prisma.hostelBed.findFirst({
      where: {
        id: data.bedId,
        isOccupied: false,
        room: { floor: { hostelId: data.hostelId } },
      },
    })

    if (!bed) {
      return validationErrorResponse({ bedId: ['Bed not found or already occupied'] })
    }

    // Create allocation and mark bed as occupied
    const allocation = await prisma.$transaction(async (tx) => {
      const newAllocation = await tx.studentHostel.create({
        data: {
          studentId: data.studentId,
          hostelId: data.hostelId,
          bedId: data.bedId,
          startDate: new Date(data.startDate),
          endDate: data.endDate ? new Date(data.endDate) : null,
          messPlan: data.messPlan,
          isActive: data.isActive ?? true,
        },
        include: {
          student: {
            select: { id: true, firstName: true, lastName: true, rollNumber: true },
          },
          hostel: { select: { id: true, name: true } },
          bed: {
            select: {
              id: true,
              number: true,
              room: { select: { number: true, floor: { select: { name: true } } } },
            },
          },
        },
      })

      await tx.hostelBed.update({
        where: { id: data.bedId },
        data: { isOccupied: true },
      })

      return newAllocation
    })

    return successResponse(allocation, 201)
  },
  { requireAuth: true, module: 'hostel' }
)
