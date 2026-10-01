import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withApiHandler, successResponse } from '@/lib/api-utils'
import { schoolWhere } from '@/lib/school-scope'

// GET /api/hostel/occupancy
// One entry per room, derived from HostelRoom -> HostelBed -> StudentHostel:
// { id, roomNumber, floorNumber, floorName, hostelId, hostelName, type, capacity,
//   totalBeds, occupied, vacant, students: [{ id, name, admissionNumber, bedNumber, className }] }
export const GET = withApiHandler(
  async (request: NextRequest, _context, session) => {
    const { searchParams } = new URL(request.url)
    const hostelId = searchParams.get('hostelId')

    const rooms = await prisma.hostelRoom.findMany({
      where: {
        isActive: true,
        floor: {
          ...(hostelId && { hostelId }),
          hostel: schoolWhere(session),
        },
      },
      include: {
        floor: {
          select: { number: true, name: true, hostel: { select: { id: true, name: true } } },
        },
        beds: {
          orderBy: { number: 'asc' },
          include: {
            student: {
              select: {
                isActive: true,
                messPlan: true,
                student: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    admissionNumber: true,
                    class: { select: { name: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ floor: { number: 'asc' } }, { number: 'asc' }],
    })

    const data = rooms.map((room) => {
      const students = room.beds
        .filter((bed) => bed.student && bed.student.isActive)
        .map((bed) => ({
          id: bed.student!.student.id,
          name: `${bed.student!.student.firstName} ${bed.student!.student.lastName}`.trim(),
          admissionNumber: bed.student!.student.admissionNumber,
          className: bed.student!.student.class?.name ?? null,
          bedNumber: bed.number,
          messPlan: bed.student!.messPlan,
        }))

      // A room's capacity is what was configured; never report fewer beds than exist.
      const capacity = Math.max(room.capacity, room.beds.length)

      return {
        id: room.id,
        roomNumber: room.number,
        floorNumber: room.floor.number,
        floorName: room.floor.name,
        hostelId: room.floor.hostel.id,
        hostelName: room.floor.hostel.name,
        type: room.type,
        capacity,
        totalBeds: room.beds.length,
        occupied: students.length,
        vacant: Math.max(0, capacity - students.length),
        students,
      }
    })

    return successResponse(data)
  },
  { requireAuth: true, module: 'hostel' }
)
