import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  getPaginationParams,
  paginatedResponse,
  successResponse
} from '@/lib/api-utils'
import { schoolWhere } from '@/lib/school-scope'
import { Prisma } from '@prisma/client'

const overdueInclude = {
  book: true,
  student: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      admissionNumber: true,
      rollNumber: true,
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.LibraryIssueInclude

// GET /api/library/overdue - issues not yet returned whose due date has passed.
// Full list by default; ?paginate=true to paginate.
export const GET = withApiHandler(
  async (request: NextRequest, context, session) => {
    const { searchParams } = new URL(request.url)
    const usePagination = searchParams.get('paginate') === 'true'

    // LibraryIssue has no schoolId; scope through book -> library
    const where: Prisma.LibraryIssueWhereInput = {
      status: { in: ['ISSUED', 'OVERDUE'] },
      returnDate: null,
      dueDate: { lt: new Date() },
      book: { library: schoolWhere(session) },
    }

    if (usePagination) {
      const params = getPaginationParams(request)
      const [overdueBooks, total] = await Promise.all([
        prisma.libraryIssue.findMany({
          where,
          include: overdueInclude,
          orderBy: { dueDate: 'asc' },
          skip: params.skip,
          take: params.limit,
        }),
        prisma.libraryIssue.count({ where })
      ])

      return paginatedResponse(overdueBooks, total, params)
    }

    const overdueBooks = await prisma.libraryIssue.findMany({
      where,
      include: overdueInclude,
      orderBy: { dueDate: 'asc' }
    })

    return successResponse(overdueBooks)
  },
  { requireAuth: true, module: 'library' }
)
