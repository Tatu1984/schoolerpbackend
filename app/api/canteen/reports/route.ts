import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import {
  withApiHandler,
  getSchoolFilter,
  successResponse,
  AuthenticatedSession,
} from '@/lib/api-utils'

function round2(value: number) {
  return Math.round(value * 100) / 100
}

function dayKey(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// Sales report for the canteen reports page. The page reads the flat fields
// (totalRevenue, totalOrders, monthlySales, popularItems[{name, quantity,
// revenue}], dailySales); `summary` and `statusBreakdown` are kept alongside.
export const GET = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const { searchParams } = new URL(request.url)
    const range = searchParams.get('range') || 'today'
    const startParam = searchParams.get('startDate')
    const endParam = searchParams.get('endDate')

    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    let from: Date = startOfToday
    let to: Date | undefined

    const customFrom = startParam ? new Date(startParam) : null
    const customTo = endParam ? new Date(endParam) : null
    if (customFrom && customTo && !isNaN(customFrom.getTime()) && !isNaN(customTo.getTime())) {
      from = customFrom
      to = customTo
    } else {
      switch (range) {
        case 'week':
          from = new Date(startOfToday)
          from.setDate(from.getDate() - 6)
          break
        case 'month':
          from = new Date(now.getFullYear(), now.getMonth(), 1)
          break
        case 'year':
          from = new Date(now.getFullYear(), 0, 1)
          break
        default:
          from = startOfToday
      }
    }

    // Orders have no schoolId - scope through the student
    const schoolFilter = getSchoolFilter(session)
    const schoolScope: Prisma.CanteenOrderWhereInput = schoolFilter.schoolId
      ? { student: { schoolId: schoolFilter.schoolId } }
      : {}

    const where: Prisma.CanteenOrderWhereInput = {
      ...schoolScope,
      orderDate: { gte: from, ...(to ? { lte: to } : {}) },
    }

    const [orders, monthly] = await Promise.all([
      prisma.canteenOrder.findMany({
        where,
        select: {
          totalAmount: true,
          status: true,
          orderDate: true,
          items: {
            select: {
              quantity: true,
              price: true,
              menuItem: { select: { id: true, name: true, category: true } },
            },
          },
        },
        orderBy: { orderDate: 'asc' },
      }),
      // Calendar-month sales, independent of the selected range
      prisma.canteenOrder.aggregate({
        where: {
          ...schoolScope,
          status: { not: 'CANCELLED' },
          orderDate: { gte: new Date(now.getFullYear(), now.getMonth(), 1) },
        },
        _sum: { totalAmount: true },
      }),
    ])

    // Cancelled orders are not sales
    const sales = orders.filter((order) => order.status !== 'CANCELLED')
    const totalRevenue = round2(sales.reduce((sum, order) => sum + order.totalAmount, 0))
    const totalOrders = sales.length

    const itemTotals = new Map<string, { id: string; name: string; category: string; quantity: number; revenue: number }>()
    const dayTotals = new Map<string, { date: string; revenue: number; orders: number }>()
    for (const order of sales) {
      const key = dayKey(order.orderDate)
      const day = dayTotals.get(key) || { date: key, revenue: 0, orders: 0 }
      day.revenue += order.totalAmount
      day.orders += 1
      dayTotals.set(key, day)

      for (const item of order.items) {
        const entry = itemTotals.get(item.menuItem.id) || {
          id: item.menuItem.id,
          name: item.menuItem.name,
          category: item.menuItem.category,
          quantity: 0,
          revenue: 0,
        }
        entry.quantity += item.quantity
        entry.revenue += item.quantity * item.price
        itemTotals.set(item.menuItem.id, entry)
      }
    }

    const popularItems = Array.from(itemTotals.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10)
      .map((item) => ({ ...item, revenue: round2(item.revenue) }))

    const dailySales = Array.from(dayTotals.values()).map((day) => ({ ...day, revenue: round2(day.revenue) }))

    const statusCounts = new Map<string, { status: string; count: number; revenue: number }>()
    for (const order of orders) {
      const entry = statusCounts.get(order.status) || { status: order.status, count: 0, revenue: 0 }
      entry.count += 1
      entry.revenue = round2(entry.revenue + order.totalAmount)
      statusCounts.set(order.status, entry)
    }

    const averageOrderValue = totalOrders > 0 ? round2(totalRevenue / totalOrders) : 0

    return successResponse({
      totalRevenue,
      totalOrders,
      monthlySales: round2(monthly._sum.totalAmount || 0),
      popularItems,
      dailySales,
      summary: {
        totalRevenue,
        totalOrders,
        averageOrderValue,
        period: range,
        startDate: from,
        endDate: to ?? now,
      },
      statusBreakdown: Array.from(statusCounts.values()),
    })
  },
  { requireAuth: true, module: 'canteen' }
)
