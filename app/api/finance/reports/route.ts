import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  successResponse
} from '@/lib/api-utils'
import { schoolWhere } from '@/lib/school-scope'

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const TREND_MONTHS = 6

const round2 = (value: number) => Math.round(value * 100) / 100

function rangeStart(range: string | null, now: Date): Date {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  switch (range) {
    case 'week':
      start.setDate(start.getDate() - 6)
      return start
    case 'quarter':
      return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
    case 'year':
      return new Date(now.getFullYear(), 0, 1)
    case 'month':
    default:
      return new Date(now.getFullYear(), now.getMonth(), 1)
  }
}

const humanize = (value: string) =>
  value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

// GET /api/finance/reports?range=week|month|quarter|year
// Revenue = fee money received (FeePayment.paidAmount by paymentDate) in the range.
// Expenses = Expense.amount by date in the range.
// Pending fees = outstanding balance on all open invoices (not range-bound).
// The trend always covers the last 6 calendar months.
export const GET = withApiHandler(
  async (request: NextRequest, context, session) => {
    const where = schoolWhere(session)
    const { searchParams } = new URL(request.url)
    const now = new Date()
    const from = rangeStart(searchParams.get('range'), now)
    const trendFrom = new Date(now.getFullYear(), now.getMonth() - (TREND_MONTHS - 1), 1)
    const earliest = from < trendFrom ? from : trendFrom

    const [payments, expenses, openInvoices] = await Promise.all([
      prisma.feePayment.findMany({
        where: {
          ...where,
          paidAmount: { gt: 0 },
          status: { not: 'CANCELLED' },
          paymentDate: { gte: earliest, lte: now },
        },
        select: { paidAmount: true, paymentDate: true, fee: { select: { type: true } } },
      }),
      prisma.expense.findMany({
        where: { ...where, date: { gte: earliest, lte: now } },
        select: { amount: true, date: true, category: true },
      }),
      prisma.feePayment.aggregate({
        _sum: { amount: true, paidAmount: true },
        where: { ...where, status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } },
      }),
    ])

    // Totals and breakdowns for the selected range
    let totalRevenue = 0
    let totalExpenses = 0
    const revenueByType = new Map<string, number>()
    const expenseByCategory = new Map<string, number>()

    // Month buckets for the trend
    const monthlyData = Array.from({ length: TREND_MONTHS }, (_, index) => {
      const date = new Date(trendFrom.getFullYear(), trendFrom.getMonth() + index, 1)
      return {
        key: `${date.getFullYear()}-${date.getMonth()}`,
        month: MONTH_LABELS[date.getMonth()],
        revenue: 0,
        expenses: 0,
      }
    })
    const monthByKey = new Map(monthlyData.map((month) => [month.key, month]))

    for (const payment of payments) {
      if (!payment.paymentDate) continue
      if (payment.paymentDate >= from) {
        totalRevenue += payment.paidAmount
        const type = humanize(payment.fee.type)
        revenueByType.set(type, (revenueByType.get(type) || 0) + payment.paidAmount)
      }
      const bucket = monthByKey.get(`${payment.paymentDate.getFullYear()}-${payment.paymentDate.getMonth()}`)
      if (bucket) bucket.revenue += payment.paidAmount
    }

    for (const expense of expenses) {
      if (expense.date >= from) {
        totalExpenses += expense.amount
        expenseByCategory.set(
          expense.category,
          (expenseByCategory.get(expense.category) || 0) + expense.amount
        )
      }
      const bucket = monthByKey.get(`${expense.date.getFullYear()}-${expense.date.getMonth()}`)
      if (bucket) bucket.expenses += expense.amount
    }

    const toBreakdown = (map: Map<string, number>) =>
      Array.from(map.entries())
        .map(([category, amount]) => ({ category, amount: round2(amount) }))
        .sort((a, b) => b.amount - a.amount)

    const pendingFees = Math.max(
      0,
      round2((openInvoices._sum.amount || 0) - (openInvoices._sum.paidAmount || 0))
    )
    totalRevenue = round2(totalRevenue)
    totalExpenses = round2(totalExpenses)
    const billed = totalRevenue + pendingFees
    const collectionRate = billed > 0 ? Math.round((totalRevenue / billed) * 1000) / 10 : 0

    return successResponse({
      range: searchParams.get('range') || 'month',
      from,
      to: now,
      totalRevenue,
      totalExpenses,
      netProfit: round2(totalRevenue - totalExpenses),
      pendingFees,
      feeCollected: totalRevenue,
      collectionRate,
      monthlyData: monthlyData.map(({ month, revenue, expenses: spent }) => ({
        month,
        revenue: round2(revenue),
        expenses: round2(spent),
      })),
      revenueBreakdown: toBreakdown(revenueByType),
      expenseBreakdown: toBreakdown(expenseByCategory),
    })
  },
  { requireAuth: true, module: 'finance' }
)
