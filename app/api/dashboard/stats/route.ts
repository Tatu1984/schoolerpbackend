import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  successResponse,
  getSchoolFilter,
  AuthenticatedSession,
} from '@/lib/api-utils'

export const GET = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const schoolFilter = getSchoolFilter(session)

    const [
      totalStudents,
      activeStudents,
      totalStaff,
      activeStaff,
      totalClasses,
      totalSections,
      totalFeeCollected,
      pendingFees,
    ] = await Promise.all([
      prisma.student.count({ where: schoolFilter }),
      prisma.student.count({ where: { ...schoolFilter, isActive: true } }),
      prisma.staff.count({ where: schoolFilter }),
      prisma.staff.count({ where: { ...schoolFilter, isActive: true } }),
      prisma.class.count({ where: { ...schoolFilter, isActive: true } }),
      prisma.section.count({
        where: { isActive: true, class: { ...schoolFilter, isActive: true } },
      }),
      prisma.feePayment.aggregate({
        where: { ...schoolFilter, status: { not: 'CANCELLED' } },
        _sum: { paidAmount: true },
      }),
      prisma.feePayment.count({
        where: { ...schoolFilter, status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } },
      }),
    ])

    const collected = totalFeeCollected._sum.paidAmount || 0
    const formatAmount = (amount: number) =>
      amount >= 100000
        ? `₹${(amount / 100000).toFixed(1)}L`
        : `₹${Math.round(amount).toLocaleString('en-IN')}`

    // `icon` is a lucide icon name; the dashboard page maps it to a component
    const stats = [
      {
        name: 'Total Students',
        value: totalStudents.toLocaleString(),
        change: `${activeStudents.toLocaleString()} active`,
        trend: 'neutral',
        icon: 'GraduationCap',
        color: 'bg-blue-500',
      },
      {
        name: 'Total Staff',
        value: totalStaff.toLocaleString(),
        change: `${activeStaff.toLocaleString()} active`,
        trend: 'neutral',
        icon: 'Users',
        color: 'bg-green-500',
      },
      {
        name: 'Active Classes',
        value: totalClasses.toLocaleString(),
        change: `${totalSections.toLocaleString()} sections`,
        trend: 'neutral',
        icon: 'BookOpen',
        color: 'bg-purple-500',
      },
      {
        name: 'Fee Collection',
        value: formatAmount(collected),
        change: `${pendingFees.toLocaleString()} pending`,
        trend: 'neutral',
        icon: 'DollarSign',
        color: 'bg-yellow-500',
      },
    ]

    return successResponse(stats)
  },
  { requireAuth: true }
)
