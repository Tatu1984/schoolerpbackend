import { Prisma } from '@prisma/client'
import { AuthenticatedSession } from '@/lib/api-utils'
import { schoolWhere } from '@/lib/school-scope'

// HostelRoom has no schoolId; it is scoped through floor -> hostel.
export function roomScope(session: AuthenticatedSession | null): Prisma.HostelRoomWhereInput {
  const { schoolId } = schoolWhere(session)
  return schoolId ? { floor: { hostel: { schoolId } } } : {}
}

export const roomInclude = {
  floor: {
    select: {
      id: true,
      name: true,
      number: true,
      hostel: { select: { id: true, name: true, code: true } },
    },
  },
  beds: {
    select: { id: true, isOccupied: true, student: { select: { isActive: true } } },
  },
} satisfies Prisma.HostelRoomInclude

type RoomWithRelations = Prisma.HostelRoomGetPayload<{ include: typeof roomInclude }>

/**
 * Shape a room for the hostel/rooms page. The model has no status column, so:
 * MAINTENANCE = inactive room, OCCUPIED = every place taken, otherwise AVAILABLE.
 */
export function toPageRoom(room: RoomWithRelations) {
  const { beds, ...rest } = room
  const currentOccupancy = beds.filter((bed) => bed.isOccupied || bed.student?.isActive).length
  const status = !room.isActive
    ? 'MAINTENANCE'
    : currentOccupancy >= room.capacity
      ? 'OCCUPIED'
      : 'AVAILABLE'

  return {
    ...rest,
    roomNumber: room.number,
    floorNumber: room.floor.number,
    floorName: room.floor.name,
    hostelId: room.floor.hostel.id,
    hostelName: room.floor.hostel.name,
    bedCount: beds.length,
    _count: { beds: beds.length },
    currentOccupancy,
    status,
  }
}

/** isActive from the page's status select (only MAINTENANCE is persisted, as inactive). */
export function isActiveFromBody(body: Record<string, unknown>): boolean | undefined {
  if (typeof body.isActive === 'boolean') return body.isActive
  if (typeof body.status === 'string' && body.status) return body.status !== 'MAINTENANCE'
  return undefined
}
