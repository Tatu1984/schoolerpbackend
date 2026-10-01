import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  successResponse,
  errorResponse,
  validationErrorResponse,
  validateBody,
  getSchoolFilter,
  AuthenticatedSession,
} from '@/lib/api-utils'
import { logAudit } from '@/lib/audit'
import { Prisma } from '@prisma/client'
import { z } from 'zod'

const optionalDate = z
  .string()
  .refine((val) => !val || !isNaN(Date.parse(val)), 'Invalid date')
  .optional()
  .nullable()

// The page sends `checkIn: null` when not present and historically used LEAVE for ON_LEAVE
const attendanceSchema = z.object({
  staffId: z.string().min(1, 'This field is required'),
  date: z.string().min(1, 'This field is required').refine((val) => !isNaN(Date.parse(val)), 'Invalid date'),
  status: z
    .enum(['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'ON_LEAVE', 'LEAVE'])
    .transform((s) => (s === 'LEAVE' ? 'ON_LEAVE' : s)),
  checkIn: optionalDate,
  checkOut: optionalDate,
  remarks: z.string().optional().nullable(),
})

// Attendance is one row per staff per calendar day: normalise to UTC midnight
function dayStart(value: string): Date {
  const d = new Date(value)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

const staffSelect = {
  id: true,
  firstName: true,
  lastName: true,
  employeeId: true,
  designation: true,
  department: true,
}

export const GET = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    if (!session) {
      return errorResponse('Unauthorized', 401)
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const staffId = searchParams.get('staffId')

    if (date && isNaN(Date.parse(date))) {
      return errorResponse('Invalid date')
    }

    const schoolFilter = getSchoolFilter(session)

    const where: Prisma.StaffAttendanceWhereInput = {
      ...(staffId && { staffId }),
    }

    if (date) {
      const start = dayStart(date)
      where.date = { gte: start, lt: new Date(start.getTime() + 24 * 60 * 60 * 1000) }
    }

    // StaffAttendance has no schoolId; scope through the staff relation
    if (session.user.role !== 'SUPER_ADMIN') {
      where.staff = { schoolId: schoolFilter.schoolId || '__no_school__' }
    }

    const attendance = await prisma.staffAttendance.findMany({
      where,
      include: { staff: { select: staffSelect } },
      orderBy: { date: 'desc' },
      // Unfiltered history is capped; a single day is always returned in full
      ...(date ? {} : { take: 500 }),
    })

    return successResponse(attendance)
  },
  { requireAuth: true, module: 'staff' }
)

export const POST = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    if (!session) {
      return errorResponse('Unauthorized', 401)
    }

    const { data, errors } = await validateBody(request, attendanceSchema)

    if (errors) {
      return validationErrorResponse(errors)
    }

    if (!data) {
      return errorResponse('Invalid request body')
    }

    const schoolFilter = getSchoolFilter(session)

    // Verify staff member exists and belongs to user's school
    const staff = await prisma.staff.findFirst({
      where: {
        id: data.staffId,
        ...schoolFilter,
      },
    })

    if (!staff) {
      return validationErrorResponse({
        staffId: ['Staff member not found or you do not have access'],
      })
    }

    const attendanceDate = dayStart(data.date)
    const fields = {
      status: data.status,
      checkIn: data.checkIn ? new Date(data.checkIn) : null,
      checkOut: data.checkOut ? new Date(data.checkOut) : null,
      remarks: data.remarks || null,
    }

    const existing = await prisma.staffAttendance.findUnique({
      where: { staffId_date: { staffId: data.staffId, date: attendanceDate } },
    })

    const attendance = await prisma.staffAttendance.upsert({
      where: { staffId_date: { staffId: data.staffId, date: attendanceDate } },
      update: fields,
      create: { staffId: data.staffId, date: attendanceDate, ...fields },
      include: { staff: { select: staffSelect } },
    })

    await logAudit(session, request, existing ? 'UPDATE' : 'CREATE', 'StaffAttendance', attendance.id, {
      staffId: data.staffId,
      date: attendanceDate.toISOString().slice(0, 10),
      status: data.status,
    })

    return successResponse(attendance, existing ? 200 : 201)
  },
  { requireAuth: true, module: 'staff' }
)
