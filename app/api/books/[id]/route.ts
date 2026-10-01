import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withApiHandler, successResponse, errorResponse, notFoundResponse } from '@/lib/api-utils'
import { schoolWhere } from '@/lib/school-scope'
import { bookFieldsFromBody, withCopyAliases } from '@/lib/library-utils'

// GET /api/books/[id]
export const GET = withApiHandler(
  async (_request: NextRequest, { params }, session) => {
    const book = await prisma.book.findFirst({
      where: { id: params.id, library: schoolWhere(session) },
      include: { library: { select: { id: true, name: true } } },
    })
    if (!book) return notFoundResponse('Book not found')
    return successResponse(withCopyAliases(book))
  },
  { requireAuth: true, module: 'library' }
)

// PUT /api/books/[id]
export const PUT = withApiHandler(
  async (request: NextRequest, { params }, session) => {
    const body = await request.json().catch(() => null)
    if (!body) return errorResponse('Invalid request body')

    const existing = await prisma.book.findFirst({
      where: { id: params.id, library: schoolWhere(session) },
      select: { id: true, libraryId: true, quantity: true, available: true },
    })
    if (!existing) return notFoundResponse('Book not found')

    let libraryId = existing.libraryId
    if (body.libraryId && body.libraryId !== existing.libraryId) {
      const library = await prisma.library.findFirst({
        where: { id: String(body.libraryId), ...schoolWhere(session) },
        select: { id: true },
      })
      if (!library) return errorResponse('Library not found', 404)
      libraryId = library.id
    }

    const { data, error } = bookFieldsFromBody(body)
    if (error) return errorResponse(error)

    if (typeof data.isbn === 'string') {
      const duplicate = await prisma.book.findFirst({
        where: { libraryId, isbn: data.isbn, id: { not: existing.id } },
        select: { id: true },
      })
      if (duplicate) return errorResponse('A book with this ISBN already exists in this library')
    }

    // Keep "available" consistent with copies currently out on loan.
    const onLoan = existing.quantity - existing.available
    const quantity = typeof data.quantity === 'number' ? data.quantity : existing.quantity
    if (quantity < onLoan) {
      return errorResponse(`Quantity cannot be less than the ${onLoan} copies currently issued`)
    }
    data.quantity = quantity
    data.available = quantity - onLoan

    const book = await prisma.book.update({
      where: { id: existing.id },
      data: { ...data, libraryId },
      include: { library: { select: { id: true, name: true } } },
    })

    return successResponse(withCopyAliases(book))
  },
  { requireAuth: true, module: 'library' }
)

// DELETE /api/books/[id]
export const DELETE = withApiHandler(
  async (_request: NextRequest, { params }, session) => {
    const existing = await prisma.book.findFirst({
      where: { id: params.id, library: schoolWhere(session) },
      select: { id: true, _count: { select: { issues: true } } },
    })
    if (!existing) return notFoundResponse('Book not found')

    if (existing._count.issues > 0) {
      const open = await prisma.libraryIssue.count({
        where: { bookId: existing.id, status: { in: ['ISSUED', 'OVERDUE'] } },
      })
      if (open > 0) return errorResponse('Cannot delete a book that is currently issued')
      // Has circulation history: retire it instead of breaking the issue records.
      await prisma.book.update({ where: { id: existing.id }, data: { isActive: false } })
      return successResponse({ id: existing.id, archived: true })
    }

    await prisma.book.delete({ where: { id: existing.id } })
    return successResponse({ id: existing.id })
  },
  { requireAuth: true, module: 'library' }
)
