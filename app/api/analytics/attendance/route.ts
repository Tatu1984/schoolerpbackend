import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  successResponse,
  getSchoolFilter,
  AuthenticatedSession,
} from '@/lib/api-utils'

const round1 = (n: number) => Math.round(n * 10) / 10
const PRESENT_STATUSES = ['PRESENT', 'LATE', 'HALF_DAY']
const WINDOW_DAYS = 30
const DEFAULTER_THRESHOLD = 75

export const GET = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const schoolFilter = getSchoolFilter(session)

    // StudentAttendance.date is a DATE column: compare on UTC-midnight calendar days
    const now = new Date()
    const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
    const windowStart = new Date(today.getTime() - (WINDOW_DAYS - 1) * 24 * 60 * 60 * 1000)

    const records = await prisma.studentAttendance.findMany({
      where: { ...schoolFilter, date: { gte: windowStart }, student: { isActive: true } },
      select: {
        date: true,
        status: true,
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
            class: { select: { id: true, name: true, grade: true } },
            section: { select: { name: true } },
          },
        },
      },
    })

    type Tally = { total: number; present: number }
    const overall: Tally = { total: 0, present: 0 }
    const todayTally: Tally = { total: 0, present: 0 }
    const byDay = new Map<string, Tally>()
    const byClass = new Map<string, Tally & { className: string; grade: number }>()
    const byStudent = new Map<
      string,
      Tally & { name: string; className: string; admissionNumber: string }
    >()

    const todayKey = today.toISOString().slice(0, 10)

    for (const r of records) {
      const present = PRESENT_STATUSES.includes(r.status)
      const dayKey = r.date.toISOString().slice(0, 10)
      const bump = (t: Tally) => {
        t.total++
        if (present) t.present++
      }

      bump(overall)
      if (dayKey === todayKey) bump(todayTally)

      if (!byDay.has(dayKey)) byDay.set(dayKey, { total: 0, present: 0 })
      bump(byDay.get(dayKey)!)

      const cls = r.student.class
      if (!byClass.has(cls.id)) byClass.set(cls.id, { total: 0, present: 0, className: cls.name, grade: cls.grade })
      bump(byClass.get(cls.id)!)

      if (!byStudent.has(r.student.id)) {
        byStudent.set(r.student.id, {
          total: 0,
          present: 0,
          name: `${r.student.firstName} ${r.student.lastName}`,
          className: r.student.section ? `${cls.name} - ${r.student.section.name}` : cls.name,
          admissionNumber: r.student.admissionNumber,
        })
      }
      bump(byStudent.get(r.student.id)!)
    }

    const pct = (t: Tally) => (t.total > 0 ? round1((t.present / t.total) * 100) : 0)

    const analytics = {
      windowDays: WINDOW_DAYS,
      overallAttendance: pct(overall),
      presentToday: todayTally.present,
      absentToday: todayTally.total - todayTally.present,
      // Students below 75% over the window
      defaulters: Array.from(byStudent.values())
        .map((s) => ({
          name: s.name,
          className: s.className,
          admissionNumber: s.admissionNumber,
          attendancePercentage: pct(s),
          absentDays: s.total - s.present,
        }))
        .filter((s) => s.attendancePercentage < DEFAULTER_THRESHOLD)
        .sort((a, b) => a.attendancePercentage - b.attendancePercentage),
      classWiseAttendance: Array.from(byClass.values())
        .sort((a, b) => a.grade - b.grade || a.className.localeCompare(b.className))
        .map((c) => ({ className: c.className, percentage: pct(c) })),
      // Last 7 days on which attendance was marked, newest first
      attendanceTrend: Array.from(byDay.entries())
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 7)
        .map(([key, t]) => ({
          day: new Date(`${key}T00:00:00Z`).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            timeZone: 'UTC',
          }),
          total: t.total,
          present: t.present,
          absent: t.total - t.present,
          percentage: pct(t),
        })),
    }

    return successResponse(analytics)
  },
  { requireAuth: true, module: 'analytics' }
)
