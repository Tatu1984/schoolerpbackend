import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  successResponse,
  getSchoolFilter,
  AuthenticatedSession,
} from '@/lib/api-utils'

const round1 = (n: number) => Math.round(n * 10) / 10
const round2 = (n: number) => Math.round(n * 100) / 100

function periodStart(period: string, now: Date): Date {
  switch (period) {
    case 'week': {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7)) // Monday
      return d
    }
    case 'quarter':
      return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
    case 'year':
      return new Date(now.getFullYear(), 0, 1)
    case 'month':
    default:
      return new Date(now.getFullYear(), now.getMonth(), 1)
  }
}

export const GET = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const schoolFilter = getSchoolFilter(session)
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'month'

    const now = new Date()
    const start = periodStart(period, now)
    // Revenue trend always covers the last 6 calendar months
    const trendStart = new Date(now.getFullYear(), now.getMonth() - 5, 1)

    const [revenue, expenses, expenseGroups, billed, outstanding, trendPayments] = await Promise.all([
      prisma.feePayment.aggregate({
        where: { ...schoolFilter, paymentDate: { gte: start } },
        _sum: { paidAmount: true },
      }),
      prisma.expense.aggregate({
        where: { ...schoolFilter, date: { gte: start } },
        _sum: { amount: true },
      }),
      prisma.expense.groupBy({
        by: ['category'],
        where: { ...schoolFilter, date: { gte: start } },
        _sum: { amount: true },
      }),
      // Collection figures are across all fees raised (not limited to the period)
      prisma.feePayment.aggregate({
        where: { ...schoolFilter, status: { not: 'CANCELLED' } },
        _sum: { amount: true, paidAmount: true },
      }),
      prisma.feePayment.aggregate({
        where: { ...schoolFilter, status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } },
        _sum: { amount: true, paidAmount: true },
      }),
      prisma.feePayment.findMany({
        where: { ...schoolFilter, paymentDate: { gte: trendStart }, paidAmount: { gt: 0 } },
        select: { paymentDate: true, paidAmount: true },
      }),
    ])

    const totalRevenue = revenue._sum.paidAmount || 0
    const totalExpenses = expenses._sum.amount || 0
    const totalBilled = billed._sum.amount || 0
    const collectedFees = billed._sum.paidAmount || 0
    const pendingFees = Math.max(0, (outstanding._sum.amount || 0) - (outstanding._sum.paidAmount || 0))

    const monthKeys: { key: string; label: string }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      monthKeys.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      })
    }
    const byMonth = new Map<string, number>()
    for (const p of trendPayments) {
      if (!p.paymentDate) continue
      const key = `${p.paymentDate.getFullYear()}-${p.paymentDate.getMonth()}`
      byMonth.set(key, (byMonth.get(key) || 0) + p.paidAmount)
    }

    const analytics = {
      period,
      totalRevenue: round2(totalRevenue),
      totalExpenses: round2(totalExpenses),
      netProfit: round2(totalRevenue - totalExpenses),
      feeCollectionRate: totalBilled > 0 ? Math.min(100, round1((collectedFees / totalBilled) * 100)) : 0,
      pendingFees: round2(pendingFees),
      collectedFees: round2(collectedFees),
      monthlyRevenue: monthKeys.map((m) => ({ month: m.label, revenue: round2(byMonth.get(m.key) || 0) })),
      expenseBreakdown: expenseGroups
        .map((g) => {
          const amount = g._sum.amount || 0
          return {
            category: g.category,
            amount: round2(amount),
            percentage: totalExpenses > 0 ? round1((amount / totalExpenses) * 100) : 0,
          }
        })
        .sort((a, b) => b.amount - a.amount),
    }

    return successResponse(analytics)
  },
  { requireAuth: true, module: 'analytics' }
)
