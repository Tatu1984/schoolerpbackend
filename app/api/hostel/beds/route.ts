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
import { hostelBedSchema } from '@/lib/validations'
import { Prisma } from '@prisma/client'

export const GET = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const pagination = getPaginationParams(request)
    const schoolFilter = getSchoolFilter(session)
    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get('roomId')
    const isOccupied = searchParams.get('isOccupied')

    const where: Prisma.HostelBedWhereInput = {
      ...(roomId && { roomId }),
      ...(isOccupied !== null && { isOccupied: isOccupied === 'true' }),
      ...(schoolFilter.schoolId && {
        room: { floor: { hostel: { schoolId: schoolFilter.schoolId } } },
      }),
    }

    const [beds, total] = await Promise.all([
      prisma.hostelBed.findMany({
        where,
        include: {
          room: {
            select: {
              id: true,
              number: true,
              floor: {
                select: {
                  id: true,
                  name: true,
                  hostel: { select: { id: true, name: true } },
                },
              },
            },
          },
          student: {
            select: {
              id: true,
              studentId: true,
              student: { select: { firstName: true, lastName: true } },
            },
          },
        },
        orderBy: { number: 'asc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.hostelBed.count({ where }),
    ])

    return paginatedResponse(beds, total, pagination)
  },
  { requireAuth: true, module: 'hostel' }
)

export const POST = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const { data, errors } = await validateBody(request, hostelBedSchema)

    if (errors) {
      return validationErrorResponse(errors)
    }

    if (!data) {
      return errorResponse('Invalid request body')
    }

    // Verify room exists and belongs to user's school
    const schoolFilter = getSchoolFilter(session)
    const room = await prisma.hostelRoom.findFirst({
      where: {
        id: data.roomId,
        ...(schoolFilter.schoolId && {
          floor: { hostel: { schoolId: schoolFilter.schoolId } },
        }),
      },
    })

    if (!room) {
      return validationErrorResponse({ roomId: ['Room not found'] })
    }

    const bed = await prisma.hostelBed.create({
      data: {
        roomId: data.roomId,
        number: data.number,
        isOccupied: data.isOccupied || false,
      },
      include: {
        room: {
          select: {
            id: true,
            number: true,
            floor: {
              select: {
                id: true,
                name: true,
                hostel: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    })

    return successResponse(bed, 201)
  },
  { requireAuth: true, module: 'hostel' }
)
