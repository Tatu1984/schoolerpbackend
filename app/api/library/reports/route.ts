import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  successResponse
} from '@/lib/api-utils'
import { schoolWhere } from '@/lib/school-scope'
import { Prisma } from '@prisma/client'

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const TREND_MONTHS = 6
const DAY_MS = 24 * 60 * 60 * 1000

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

// GET /api/library/reports?range=week|month|quarter|year
// Issue/return counts, most issued books, categories and top readers cover the
// selected range. Overdue figures are the current state. The monthly trend
// always covers the last 6 calendar months.
export const GET = withApiHandler(
  async (request: NextRequest, context, session) => {
    const { searchParams } = new URL(request.url)
    const now = new Date()
    const from = rangeStart(searchParams.get('range'), now)
    const trendFrom = new Date(now.getFullYear(), now.getMonth() - (TREND_MONTHS - 1), 1)

    // LibraryIssue has no schoolId; scope through book -> library
    const bookWhere: Prisma.BookWhereInput = { library: schoolWhere(session) }
    const issueScope: Prisma.LibraryIssueWhereInput = { book: bookWhere }

    const [
      totalBooks,
      copies,
      issuesInRange,
      totalReturns,
      overdueIssues,
      currentlyIssued,
      trendIssues,
    ] = await Promise.all([
      prisma.book.count({ where: bookWhere }),
      prisma.book.aggregate({ where: bookWhere, _sum: { quantity: true, available: true } }),
      prisma.libraryIssue.findMany({
        where: { ...issueScope, issueDate: { gte: from, lte: now } },
        select: {
          bookId: true,
          studentId: true,
          book: { select: { title: true, author: true, category: true } },
          student: {
            select: {
              firstName: true,
              lastName: true,
              class: { select: { name: true } },
              section: { select: { name: true } },
            },
          },
        },
      }),
      prisma.libraryIssue.count({
        where: { ...issueScope, status: 'RETURNED', returnDate: { gte: from, lte: now } },
      }),
      prisma.libraryIssue.findMany({
        where: {
          ...issueScope,
          status: { in: ['ISSUED', 'OVERDUE'] },
          returnDate: null,
          dueDate: { lt: now },
        },
        select: { dueDate: true },
      }),
      prisma.libraryIssue.count({
        where: { ...issueScope, status: { in: ['ISSUED', 'OVERDUE'] }, returnDate: null },
      }),
      prisma.libraryIssue.findMany({
        where: { ...issueScope, issueDate: { gte: trendFrom, lte: now } },
        select: { issueDate: true },
      }),
    ])

    const books = new Map<string, { title: string; author: string; issueCount: number }>()
    const categories = new Map<string, number>()
    const readers = new Map<string, { name: string; class: string; booksRead: number }>()

    for (const issue of issuesInRange) {
      const book = books.get(issue.bookId)
      if (book) book.issueCount++
      else {
        books.set(issue.bookId, {
          title: issue.book.title,
          author: issue.book.author || 'Unknown author',
          issueCount: 1,
        })
      }

      const category = issue.book.category || 'Uncategorized'
      categories.set(category, (categories.get(category) || 0) + 1)

      const reader = readers.get(issue.studentId)
      if (reader) reader.booksRead++
      else {
        readers.set(issue.studentId, {
          name: `${issue.student.firstName} ${issue.student.lastName}`.trim(),
          class: [issue.student.class?.name, issue.student.section?.name].filter(Boolean).join(' - '),
          booksRead: 1,
        })
      }
    }

    const overdueStats = { range1: 0, range2: 0, range3: 0 }
    for (const issue of overdueIssues) {
      const days = Math.floor((now.getTime() - issue.dueDate.getTime()) / DAY_MS)
      if (days <= 7) overdueStats.range1++
      else if (days <= 14) overdueStats.range2++
      else overdueStats.range3++
    }

    const monthlyTrend = Array.from({ length: TREND_MONTHS }, (_, index) => {
      const date = new Date(trendFrom.getFullYear(), trendFrom.getMonth() + index, 1)
      return { key: `${date.getFullYear()}-${date.getMonth()}`, month: MONTH_LABELS[date.getMonth()], count: 0 }
    })
    const trendByKey = new Map(monthlyTrend.map((month) => [month.key, month]))
    for (const issue of trendIssues) {
      const bucket = trendByKey.get(`${issue.issueDate.getFullYear()}-${issue.issueDate.getMonth()}`)
      if (bucket) bucket.count++
    }

    return successResponse({
      range: searchParams.get('range') || 'month',
      from,
      to: now,
      totalBooks,
      totalCopies: copies._sum.quantity || 0,
      availableBooks: copies._sum.available || 0,
      totalIssues: issuesInRange.length,
      totalReturns,
      currentlyIssued,
      overdueCount: overdueIssues.length,
      activeMembers: readers.size,
      mostIssuedBooks: Array.from(books.values())
        .sort((a, b) => b.issueCount - a.issueCount)
        .slice(0, 10),
      categoryDistribution: Array.from(categories.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
      topReaders: Array.from(readers.values())
        .sort((a, b) => b.booksRead - a.booksRead)
        .slice(0, 5),
      overdueStats,
      monthlyTrend: monthlyTrend.map(({ month, count }) => ({ month, count })),
    })
  },
  { requireAuth: true, module: 'library' }
)
