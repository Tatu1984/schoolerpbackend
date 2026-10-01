import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  successResponse,
  errorResponse,
  validationErrorResponse,
  getPaginationParams,
  paginatedResponse,
  AuthenticatedSession,
} from '@/lib/api-utils'
import { hostelRoomSchema } from '@/lib/validations'
import { schoolWhere } from '@/lib/school-scope'
import { readJson, parseWith, str, num } from '@/lib/form-body'
import { Prisma } from '@prisma/client'
import { isActiveFromBody, roomInclude, roomScope, toPageRoom } from './shared'

// GET /api/hostel/rooms - full list (optionally ?hostelId= / ?floorId=).
// Pass ?page= or ?limit= to paginate.
export const GET = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const { searchParams } = new URL(request.url)
    const floorId = searchParams.get('floorId')
    const hostelId = searchParams.get('hostelId')

    const where: Prisma.HostelRoomWhereInput = {
      AND: [
        roomScope(session),
        ...(floorId ? [{ floorId }] : []),
        ...(hostelId ? [{ floor: { hostelId } }] : []),
      ],
    }
    const orderBy: Prisma.HostelRoomOrderByWithRelationInput[] = [
      { floor: { hostel: { name: 'asc' } } },
      { floor: { number: 'asc' } },
      { number: 'asc' },
    ]

    if (searchParams.has('page') || searchParams.has('limit')) {
      const pagination = getPaginationParams(request)
      const [rooms, total] = await Promise.all([
        prisma.hostelRoom.findMany({
          where,
          include: roomInclude,
          orderBy,
          skip: pagination.skip,
          take: pagination.limit,
        }),
        prisma.hostelRoom.count({ where }),
      ])
      return paginatedResponse(rooms.map(toPageRoom), total, pagination)
    }

    const rooms = await prisma.hostelRoom.findMany({ where, include: roomInclude, orderBy })
    return successResponse(rooms.map(toPageRoom))
  },
  { requireAuth: true, module: 'hostel' }
)

// POST /api/hostel/rooms
// Accepts either { floorId, number } or the page's { hostelId?, floorNumber, roomNumber }.
// With floorNumber the floor is looked up in the hostel and created when missing.
// One bed per unit of capacity is created so the room can be allocated.
export const POST = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const body = await readJson(request)
    const scope = schoolWhere(session)

    let floorId = str(body.floorId)

    if (floorId) {
      const floor = await prisma.hostelFloor.findFirst({
        where: { id: floorId, ...(scope.schoolId && { hostel: { schoolId: scope.schoolId } }) },
        select: { id: true },
      })
      if (!floor) {
        return validationErrorResponse({ floorId: ['Floor not found'] })
      }
    } else {
      const floorNumber = num(body.floorNumber)
      if (floorNumber === undefined || !Number.isInteger(floorNumber)) {
        return validationErrorResponse({ floorNumber: ['Floor number is required'] })
      }

      const requestedHostelId = str(body.hostelId)
      const hostel = await prisma.hostel.findFirst({
        where: { ...scope, ...(requestedHostelId && { id: requestedHostelId }) },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      })
      if (!hostel) {
        return errorResponse(
          requestedHostelId ? 'Hostel not found' : 'Create a hostel before adding rooms'
        )
      }

      const floor =
        (await prisma.hostelFloor.findFirst({
          where: { hostelId: hostel.id, number: floorNumber },
          select: { id: true },
        })) ??
        (await prisma.hostelFloor.create({
          data: { hostelId: hostel.id, number: floorNumber, name: `Floor ${floorNumber}` },
          select: { id: true },
        }))
      floorId = floor.id
    }

    const { data, errors } = parseWith(hostelRoomSchema, {
      floorId,
      number: str(body.roomNumber ?? body.number) ?? '',
      capacity: num(body.capacity),
      type: str(body.type),
      isActive: isActiveFromBody(body),
    })

    if (errors) {
      return validationErrorResponse(errors)
    }

    const floor = await prisma.hostelFloor.findUnique({
      where: { id: data.floorId },
      select: { hostelId: true },
    })
    const duplicate = await prisma.hostelRoom.findFirst({
      where: { number: data.number, floor: { hostelId: floor?.hostelId } },
      select: { id: true },
    })
    if (duplicate) {
      return errorResponse('A room with this number already exists in this hostel')
    }

    const room = await prisma.hostelRoom.create({
      data: {
        floorId: data.floorId,
        number: data.number,
        capacity: data.capacity,
        type: data.type,
        isActive: data.isActive,
        beds: {
          create: Array.from({ length: data.capacity }, (_, index) => ({
            number: String(index + 1),
          })),
        },
      },
      include: roomInclude,
    })

    return successResponse(toPageRoom(room), 201)
  },
  { requireAuth: true, module: 'hostel' }
)
