import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  successResponse,
  errorResponse,
  AuthenticatedSession,
} from '@/lib/api-utils'

const STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'LEAVE']

function dayOnly(value: string | null) {
  const d = value ? new Date(`${value.slice(0, 10)}T00:00:00.000Z`) : new Date()
  if (isNaN(d.getTime())) return null
  d.setUTCHours(0, 0, 0, 0)
  return d
}

// GET ?classId=&sectionId=&date=YYYY-MM-DD -> students of the class with their status for the day
export const GET = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const { searchParams } = new URL(request.url)
    const classId = searchParams.get('classId')
    const sectionId = searchParams.get('sectionId')
    const date = dayOnly(searchParams.get('date'))
    const schoolId = session?.user.schoolId
    if (!schoolId) return errorResponse('School ID is required')
    if (!classId) return errorResponse('classId is required')
    if (!date) return errorResponse('Invalid date')

    const students = await prisma.student.findMany({
      where: { schoolId, classId, isActive: true, ...(sectionId && { sectionId }) },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        admissionNumber: true,
        rollNumber: true,
        attendance: { where: { date }, select: { status: true, remarks: true } },
      },
      orderBy: [{ rollNumber: 'asc' }, { firstName: 'asc' }],
    })

    return successResponse(
      students.map(({ attendance, ...s }) => ({
        ...s,
        status: attendance[0]?.status || null,
        remarks: attendance[0]?.remarks || '',
      }))
    )
  },
  { requireAuth: true, module: 'students' }
)

// POST { date, records: [{ studentId, status, remarks }] }
export const POST = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const body = await request.json().catch(() => null)
    const schoolId = session?.user.schoolId
    if (!schoolId) return errorResponse('School ID is required')
    const date = dayOnly(body?.date || null)
    if (!date || !Array.isArray(body?.records)) return errorResponse('date and records are required')

    const records = body.records.filter(
      (r: { studentId?: string; status?: string }) => r?.studentId && STATUSES.includes(r.status || '')
    )
    const valid = await prisma.student.findMany({
      where: { schoolId, id: { in: records.map((r: { studentId: string }) => r.studentId) } },
      select: { id: true },
    })
    const validIds = new Set(valid.map((s) => s.id))

    await prisma.$transaction(
      records
        .filter((r: { studentId: string }) => validIds.has(r.studentId))
        .map((r: { studentId: string; status: string; remarks?: string }) =>
          prisma.studentAttendance.upsert({
            where: { studentId_date: { studentId: r.studentId, date } },
            update: { status: r.status, remarks: r.remarks || null, markedBy: session?.user.id },
            create: {
              schoolId,
              studentId: r.studentId,
              date,
              status: r.status,
              remarks: r.remarks || null,
              markedBy: session?.user.id,
            },
          })
        )
    )
    return successResponse({ saved: validIds.size })
  },
  { requireAuth: true, module: 'students' }
)
