import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { withApiHandler, successResponse, errorResponse } from '@/lib/api-utils'
import { schoolWhere, resolveSchoolId } from '@/lib/school-scope'
import { bookFieldsFromBody, withCopyAliases } from '@/lib/library-utils'

// GET /api/books - full catalogue for the school (screens search client-side)
// Filters: search, category, libraryId, available=true, isActive=true|false
export const GET = withApiHandler(
  async (request: NextRequest, _context, session) => {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const category = searchParams.get('category')
    const libraryId = searchParams.get('libraryId')
    const isActive = searchParams.get('isActive')

    const where: Prisma.BookWhereInput = {
      library: schoolWhere(session),
      ...(libraryId && { libraryId }),
      ...(category && { category }),
      ...(isActive !== null && { isActive: isActive === 'true' }),
      ...(searchParams.get('available') === 'true' && { available: { gt: 0 } }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { author: { contains: search, mode: 'insensitive' } },
          { isbn: { contains: search, mode: 'insensitive' } },
        ],
      }),
    }

    const books = await prisma.book.findMany({
      where,
      include: {
        library: { select: { id: true, name: true } },
        _count: { select: { issues: true } },
      },
      orderBy: { title: 'asc' },
      take: 2000,
    })

    return successResponse(books.map(withCopyAliases))
  },
  { requireAuth: true, module: 'library' }
)

// POST /api/books
export const POST = withApiHandler(
  async (request: NextRequest, _context, session) => {
    const body = await request.json().catch(() => null)
    if (!body) return errorResponse('Invalid request body')

    if (!body.title || !String(body.title).trim()) return errorResponse('Title is required')

    let library: { id: string } | null
    if (body.libraryId) {
      library = await prisma.library.findFirst({
        where: { id: String(body.libraryId), ...schoolWhere(session) },
        select: { id: true },
      })
      if (!library) return errorResponse('Library not found', 404)
    } else {
      // No library chosen: only acceptable when the school has none yet, in which
      // case its first book creates a default "Main Library".
      const schoolId = await resolveSchoolId(session, body.schoolId)
      if (!schoolId) return errorResponse('No school associated with this account')
      const existing = await prisma.library.count({ where: { schoolId } })
      if (existing > 0) return errorResponse('Library is required')
      library = await prisma.library.upsert({
        where: { schoolId_code: { schoolId, code: 'MAIN' } },
        update: {},
        create: { schoolId, name: 'Main Library', code: 'MAIN' },
        select: { id: true },
      })
    }

    const { data, error } = bookFieldsFromBody(body)
    if (error) return errorResponse(error)

    if (typeof data.isbn === 'string') {
      const duplicate = await prisma.book.findFirst({
        where: { libraryId: library.id, isbn: data.isbn },
        select: { id: true },
      })
      if (duplicate) return errorResponse('A book with this ISBN already exists in this library')
    }

    const quantity = typeof data.quantity === 'number' ? data.quantity : 1
    const available = typeof data.available === 'number' ? Math.min(data.available, quantity) : quantity

    const book = await prisma.book.create({
      data: {
        ...(data as Omit<Prisma.BookUncheckedCreateInput, 'libraryId' | 'title'>),
        title: String(body.title).trim(),
        libraryId: library.id,
        quantity,
        available,
      },
      include: { library: { select: { id: true, name: true } } },
    })

    return successResponse(withCopyAliases(book), 201)
  },
  { requireAuth: true, module: 'library' }
)
