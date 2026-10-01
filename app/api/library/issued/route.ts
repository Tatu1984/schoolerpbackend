import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withApiHandler, getPaginationParams, paginatedResponse, successResponse } from '@/lib/api-utils'
import { schoolWhere } from '@/lib/school-scope'

// GET /api/library/issued - books currently out on loan (issued or overdue)
export const GET = withApiHandler(
  async (request: NextRequest, _context, session) => {
    const { searchParams } = new URL(request.url)
    const usePagination = searchParams.get('paginate') === 'true'
    const studentId = searchParams.get('studentId')

    const where = {
      status: { in: ['ISSUED', 'OVERDUE'] as ('ISSUED' | 'OVERDUE')[] },
      book: { library: schoolWhere(session) },
      ...(studentId && { studentId }),
    }
    const include = {
      book: true,
      student: { include: { class: true, section: true } },
    }

    if (usePagination) {
      const params = getPaginationParams(request)
      const [issuedBooks, total] = await Promise.all([
        prisma.libraryIssue.findMany({
          where,
          include,
          orderBy: { issueDate: 'desc' },
          skip: params.skip,
          take: params.limit,
        }),
        prisma.libraryIssue.count({ where }),
      ])
      return paginatedResponse(issuedBooks, total, params)
    }

    const issuedBooks = await prisma.libraryIssue.findMany({
      where,
      include,
      orderBy: { issueDate: 'desc' },
    })
    return successResponse(issuedBooks)
  },
  { requireAuth: true, module: 'library' }
)
