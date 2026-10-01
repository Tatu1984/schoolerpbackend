import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withApiHandler, successResponse, errorResponse, notFoundResponse } from '@/lib/api-utils'
import { schoolWhere, parseDate } from '@/lib/school-scope'

// POST /api/library/issue  Body: { bookId, studentId, dueDate, issueDate?, notes? }
export const POST = withApiHandler(
  async (request: NextRequest, _context, session) => {
    const body = await request.json().catch(() => null)
    if (!body) return errorResponse('Invalid request body')
    if (!body.bookId) return errorResponse('Book is required')
    if (!body.studentId) return errorResponse('Student is required')

    const dueDate = parseDate(body.dueDate)
    if (!dueDate) return errorResponse('A valid due date is required')
    const issueDate = parseDate(body.issueDate) || new Date()
    if (dueDate < new Date(issueDate.getFullYear(), issueDate.getMonth(), issueDate.getDate())) {
      return errorResponse('Due date cannot be before the issue date')
    }

    const [book, student] = await Promise.all([
      prisma.book.findFirst({
        where: { id: String(body.bookId), library: schoolWhere(session) },
        select: { id: true, title: true, isActive: true, library: { select: { schoolId: true } } },
      }),
      prisma.student.findFirst({
        where: { id: String(body.studentId), ...schoolWhere(session) },
        select: { id: true, schoolId: true },
      }),
    ])
    if (!book || !book.isActive) return notFoundResponse('Book not found')
    if (!student) return notFoundResponse('Student not found')
    if (student.schoolId !== book.library.schoolId) {
      return errorResponse('Book and student belong to different schools')
    }

    const alreadyHas = await prisma.libraryIssue.findFirst({
      where: { bookId: book.id, studentId: student.id, status: { in: ['ISSUED', 'OVERDUE'] } },
      select: { id: true },
    })
    if (alreadyHas) return errorResponse('This student already has a copy of this book')

    const issue = await prisma.$transaction(async (tx) => {
      // Guarded decrement so two concurrent issues cannot take the last copy.
      const taken = await tx.book.updateMany({
        where: { id: book.id, available: { gt: 0 } },
        data: { available: { decrement: 1 } },
      })
      if (taken.count === 0) return null

      return tx.libraryIssue.create({
        data: {
          bookId: book.id,
          studentId: student.id,
          issueDate,
          dueDate,
          status: 'ISSUED',
          notes: body.notes ? String(body.notes) : null,
        },
        include: {
          book: true,
          student: { include: { class: true, section: true } },
        },
      })
    })

    if (!issue) return errorResponse('No copies of this book are available')
    return successResponse(issue, 201)
  },
  { requireAuth: true, module: 'library' }
)
