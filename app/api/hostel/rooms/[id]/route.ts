import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
} from '@/lib/api-utils'
import { hostelRoomSchema } from '@/lib/validations'
import { readJson, parseWith, str, num } from '@/lib/form-body'
import { isActiveFromBody, roomInclude, roomScope, toPageRoom } from '../shared'

const roomUpdateSchema = hostelRoomSchema.partial().omit({ floorId: true })

const existingInclude = {
  floor: { select: { hostelId: true, number: true } },
  beds: {
    select: { id: true, number: true, isOccupied: true, student: { select: { id: true } } },
  },
} as const

// GET /api/hostel/rooms/[id]
export const GET = withApiHandler(
  async (_request: NextRequest, { params }, session) => {
    const room = await prisma.hostelRoom.findFirst({
      where: { AND: [{ id: params.id }, roomScope(session)] },
      include: roomInclude,
    })

    if (!room) {
      return notFoundResponse('Room not found')
    }

    return successResponse(toPageRoom(room))
  },
  { requireAuth: true, module: 'hostel' }
)

// PUT /api/hostel/rooms/[id]
// Accepts the page's { roomNumber, floorNumber, capacity, type, status }.
// Changing floorNumber moves the room to that floor of the same hostel
// (created when missing). Beds are kept in step with capacity.
export const PUT = withApiHandler(
  async (request: NextRequest, { params }, session) => {
    const existing = await prisma.hostelRoom.findFirst({
      where: { AND: [{ id: params.id }, roomScope(session)] },
      include: existingInclude,
    })

    if (!existing) {
      return notFoundResponse('Room not found')
    }

    const body = await readJson(request)
    const rawNumber = body.roomNumber ?? body.number

    const { data, errors } = parseWith(roomUpdateSchema, {
      ...(rawNumber !== undefined && { number: str(rawNumber) ?? '' }),
      ...(body.capacity !== undefined && { capacity: num(body.capacity) }),
      ...(body.type !== undefined && { type: str(body.type) }),
      isActive: isActiveFromBody(body),
    })

    if (errors) {
      return validationErrorResponse(errors)
    }

    const hostelId = existing.floor.hostelId

    // Floor change within the same hostel
    let floorId: string | undefined
    const floorNumber = num(body.floorNumber)
    if (floorNumber !== undefined && floorNumber !== existing.floor.number) {
      if (!Number.isInteger(floorNumber)) {
        return validationErrorResponse({ floorNumber: ['Invalid floor number'] })
      }
      const floor =
        (await prisma.hostelFloor.findFirst({
          where: { hostelId, number: floorNumber },
          select: { id: true },
        })) ??
        (await prisma.hostelFloor.create({
          data: { hostelId, number: floorNumber, name: `Floor ${floorNumber}` },
          select: { id: true },
        }))
      floorId = floor.id
    }

    if (data.number !== undefined && data.number !== existing.number) {
      const duplicate = await prisma.hostelRoom.findFirst({
        where: { number: data.number, id: { not: existing.id }, floor: { hostelId } },
        select: { id: true },
      })
      if (duplicate) {
        return errorResponse('A room with this number already exists in this hostel')
      }
    }

    // Keep one bed per unit of capacity. Beds with an allocation are never removed.
    const bedsToCreate: { roomId: string; number: string }[] = []
    let bedIdsToDelete: string[] = []
    if (data.capacity !== undefined && data.capacity !== existing.beds.length) {
      if (data.capacity > existing.beds.length) {
        const taken = new Set(existing.beds.map((bed) => bed.number))
        let next = 1
        while (bedsToCreate.length < data.capacity - existing.beds.length) {
          if (!taken.has(String(next))) {
            bedsToCreate.push({ roomId: existing.id, number: String(next) })
          }
          next++
        }
      } else {
        const removable = existing.beds.filter((bed) => !bed.isOccupied && !bed.student)
        const surplus = existing.beds.length - data.capacity
        if (removable.length < surplus) {
          return errorResponse(
            `Cannot reduce capacity to ${data.capacity}: ${existing.beds.length - removable.length} bed(s) are allocated`
          )
        }
        bedIdsToDelete = removable
          .sort((a, b) => b.number.localeCompare(a.number, undefined, { numeric: true }))
          .slice(0, surplus)
          .map((bed) => bed.id)
      }
    }

    const room = await prisma.$transaction(async (tx) => {
      if (bedsToCreate.length) {
        await tx.hostelBed.createMany({ data: bedsToCreate })
      }
      if (bedIdsToDelete.length) {
        await tx.hostelBed.deleteMany({ where: { id: { in: bedIdsToDelete } } })
      }
      return tx.hostelRoom.update({
        where: { id: existing.id },
        data: { ...data, ...(floorId && { floorId }) },
        include: roomInclude,
      })
    })

    return successResponse(toPageRoom(room))
  },
  { requireAuth: true, module: 'hostel' }
)

// DELETE /api/hostel/rooms/[id] - beds cascade with the room
export const DELETE = withApiHandler(
  async (_request: NextRequest, { params }, session) => {
    const existing = await prisma.hostelRoom.findFirst({
      where: { AND: [{ id: params.id }, roomScope(session)] },
      include: existingInclude,
    })

    if (!existing) {
      return notFoundResponse('Room not found')
    }

    // StudentHostel rows reference beds without cascade
    const allocated = existing.beds.filter((bed) => bed.student).length
    if (allocated > 0) {
      return errorResponse(
        `Cannot delete room: ${allocated} bed(s) have student allocations. Remove them first.`
      )
    }

    await prisma.hostelRoom.delete({ where: { id: existing.id } })

    return successResponse({ message: 'Room deleted successfully' })
  },
  { requireAuth: true, module: 'hostel' }
)
