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

// Percentage change of `current` against `previous`
const growth = (current: number, previous: number) =>
  previous > 0 ? round1(((current - previous) / previous) * 100) : current > 0 ? 100 : 0

export const GET = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const schoolFilter = getSchoolFilter(session)

    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const billedWhere = { ...schoolFilter, status: { not: 'CANCELLED' as const } }

    const [
      totalStudents,
      newStudents,
      totalStaff,
      totalCourses,
      feeTotals,
      revenueThisMonth,
      revenueLastMonth,
      attendanceTotal,
      attendancePresent,
    ] = await Promise.all([
      prisma.student.count({ where: { ...schoolFilter, isActive: true } }),
      prisma.student.count({ where: { ...schoolFilter, isActive: true, createdAt: { gte: thirtyDaysAgo } } }),
      prisma.staff.count({ where: { ...schoolFilter, isActive: true } }),
      prisma.course.count({ where: { isActive: true, ...schoolFilter } }),
      prisma.feePayment.aggregate({
        where: billedWhere,
        _sum: { paidAmount: true, amount: true },
      }),
      prisma.feePayment.aggregate({
        where: { ...schoolFilter, paymentDate: { gte: monthStart } },
        _sum: { paidAmount: true },
      }),
      prisma.feePayment.aggregate({
        where: { ...schoolFilter, paymentDate: { gte: prevMonthStart, lt: monthStart } },
        _sum: { paidAmount: true },
      }),
      prisma.studentAttendance.count({ where: { ...schoolFilter, date: { gte: thirtyDaysAgo } } }),
      prisma.studentAttendance.count({
        where: { ...schoolFilter, date: { gte: thirtyDaysAgo }, status: { in: PRESENT_STATUSES } },
      }),
    ])

    const collected = feeTotals._sum.paidAmount || 0
    const billed = feeTotals._sum.amount || 0

    const stats = {
      totalStudents,
      totalStaff,
      totalRevenue: collected,
      totalCourses,
      // Students added in the last 30 days relative to the roll before that
      studentGrowth: growth(totalStudents, totalStudents - newStudents),
      // Fees collected this calendar month vs last month
      revenueGrowth: growth(revenueThisMonth._sum.paidAmount || 0, revenueLastMonth._sum.paidAmount || 0),
      // Student attendance over the last 30 days
      attendanceRate: attendanceTotal > 0 ? round1((attendancePresent / attendanceTotal) * 100) : 0,
      feeCollectionRate: billed > 0 ? Math.min(100, round1((collected / billed) * 100)) : 0,
    }

    return successResponse(stats)
  },
  { requireAuth: true, module: 'analytics' }
)
