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
const PASS_PERCENTAGE = 40
const TOP_PERCENTAGE = 75
const LOW_PERCENTAGE = 50

function letterGrade(percentage: number): string {
  if (percentage >= 90) return 'A+'
  if (percentage >= 80) return 'A'
  if (percentage >= 70) return 'B'
  if (percentage >= 60) return 'C'
  if (percentage >= 50) return 'D'
  if (percentage >= PASS_PERCENTAGE) return 'E'
  return 'F'
}

export const GET = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const schoolFilter = getSchoolFilter(session)

    const [students, examResults, attendanceGroups] = await Promise.all([
      prisma.student.findMany({
        where: { ...schoolFilter, isActive: true },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          class: { select: { id: true, name: true, grade: true } },
          section: { select: { name: true } },
        },
      }),
      prisma.examResult.findMany({
        where: { student: { ...schoolFilter, isActive: true } },
        select: { studentId: true, score: true, exam: { select: { maxScore: true } } },
      }),
      prisma.studentAttendance.groupBy({
        by: ['studentId', 'status'],
        where: { ...schoolFilter, student: { isActive: true } },
        _count: { _all: true },
      }),
    ])

    // Attendance % per student (all recorded days)
    const attendance = new Map<string, { total: number; present: number }>()
    for (const g of attendanceGroups) {
      const t = attendance.get(g.studentId) || { total: 0, present: 0 }
      t.total += g._count._all
      if (PRESENT_STATUSES.includes(g.status)) t.present += g._count._all
      attendance.set(g.studentId, t)
    }
    const attendancePct = (studentId: string): number | null => {
      const t = attendance.get(studentId)
      return t && t.total > 0 ? round1((t.present / t.total) * 100) : null
    }

    // Exam % per student = total score / total max score across all their exams
    const marks = new Map<string, { score: number; max: number }>()
    for (const r of examResults) {
      if (!r.exam.maxScore) continue
      const m = marks.get(r.studentId) || { score: 0, max: 0 }
      m.score += r.score
      m.max += r.exam.maxScore
      marks.set(r.studentId, m)
    }
    const examPct = (studentId: string): number | null => {
      const m = marks.get(studentId)
      return m && m.max > 0 ? round1((m.score / m.max) * 100) : null
    }

    const rows = students.map((s) => ({
      id: s.id,
      name: `${s.firstName} ${s.lastName}`,
      classId: s.class.id,
      classLabel: s.class.name,
      classGrade: s.class.grade,
      className: s.section ? `${s.class.name} - ${s.section.name}` : s.class.name,
      percentage: examPct(s.id),
      attendance: attendancePct(s.id),
    }))

    const graded = rows.filter((r) => r.percentage !== null) as (typeof rows[number] & { percentage: number })[]
    const present = (r: { name: string; className: string; percentage: number; attendance: number | null }) => ({
      name: r.name,
      className: r.className,
      percentage: r.percentage,
      grade: letterGrade(r.percentage),
      attendance: r.attendance ?? 0,
    })

    const totalAttendance = Array.from(attendance.values()).reduce(
      (acc, t) => ({ total: acc.total + t.total, present: acc.present + t.present }),
      { total: 0, present: 0 }
    )

    const classes = new Map<string, { className: string; grade: number; members: typeof rows }>()
    for (const r of rows) {
      if (!classes.has(r.classId)) classes.set(r.classId, { className: r.classLabel, grade: r.classGrade, members: [] })
      classes.get(r.classId)!.members.push(r)
    }
    const avg = (values: number[]) =>
      values.length > 0 ? round1(values.reduce((a, b) => a + b, 0) / values.length) : 0

    const analytics = {
      totalStudents: students.length,
      averageAttendance:
        totalAttendance.total > 0 ? round1((totalAttendance.present / totalAttendance.total) * 100) : 0,
      topPerformers: graded
        .filter((r) => r.percentage >= TOP_PERCENTAGE)
        .sort((a, b) => b.percentage - a.percentage)
        .map(present),
      lowPerformers: graded
        .filter((r) => r.percentage < LOW_PERCENTAGE)
        .sort((a, b) => a.percentage - b.percentage)
        .map(present),
      classWisePerformance: Array.from(classes.values())
        .sort((a, b) => a.grade - b.grade || a.className.localeCompare(b.className))
        .map((c) => {
          const percentages = c.members.filter((m) => m.percentage !== null).map((m) => m.percentage as number)
          const attendances = c.members.filter((m) => m.attendance !== null).map((m) => m.attendance as number)
          return {
            className: c.className,
            studentCount: c.members.length,
            avgPercentage: avg(percentages),
            avgAttendance: avg(attendances),
            passRate:
              percentages.length > 0
                ? round1((percentages.filter((p) => p >= PASS_PERCENTAGE).length / percentages.length) * 100)
                : 0,
          }
        }),
      behaviorMetrics: {},
    }

    return successResponse(analytics)
  },
  { requireAuth: true, module: 'analytics' }
)
