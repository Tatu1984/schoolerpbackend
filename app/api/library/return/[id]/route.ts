import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withApiHandler, successResponse, errorResponse, notFoundResponse } from '@/lib/api-utils'
import { schoolWhere, parseDate, parseNumber } from '@/lib/school-scope'

// POST /api/library/return/[id] - mark an issue as returned and put the copy back
// Optional body: { returnDate?, fine?, notes? }
export const POST = withApiHandler(
  async (request: NextRequest, { params }, session) => {
    const body = await request.json().catch(() => ({}))

    const existing = await prisma.libraryIssue.findFirst({
      where: { id: params.id, book: { library: schoolWhere(session) } },
      select: { id: true, bookId: true, status: true },
    })
    if (!existing) return notFoundResponse('Issue record not found')
    if (existing.status !== 'ISSUED' && existing.status !== 'OVERDUE') {
      return errorResponse('This book has already been returned')
    }

    const returnDate = parseDate(body?.returnDate) || new Date()
    const fine = parseNumber(body?.fine)

    const issue = await prisma.$transaction(async (tx) => {
      // Guard on status so a double click cannot return the same copy twice.
      const closed = await tx.libraryIssue.updateMany({
        where: { id: existing.id, status: { in: ['ISSUED', 'OVERDUE'] } },
        data: {
          status: 'RETURNED',
          returnDate,
          ...(fine !== null && fine >= 0 && { fine }),
          ...(body?.notes && { notes: String(body.notes) }),
        },
      })
      if (closed.count === 0) return null

      const book = await tx.book.findUnique({
        where: { id: existing.bookId },
        select: { available: true, quantity: true },
      })
      if (book && book.available < book.quantity) {
        await tx.book.update({ where: { id: existing.bookId }, data: { available: { increment: 1 } } })
      }

      return tx.libraryIssue.findUnique({
        where: { id: existing.id },
        include: { book: true, student: { include: { class: true, section: true } } },
      })
    })

    if (!issue) return errorResponse('This book has already been returned')
    return successResponse(issue)
  },
  { requireAuth: true, module: 'library' }
)
