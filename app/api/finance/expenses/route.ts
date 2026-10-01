import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  getPaginationParams,
  paginatedResponse,
  successResponse,
  errorResponse,
  validationErrorResponse
} from '@/lib/api-utils'
import { expenseSchema } from '@/lib/validations'
import { schoolWhere, resolveSchoolId } from '@/lib/school-scope'
import { readJson, parseWith } from '@/lib/form-body'
import { normalizeExpenseBody, toPageExpense } from './shared'

export const GET = withApiHandler(
  async (request: NextRequest, context, session) => {
    const { searchParams } = new URL(request.url)
    const usePagination = searchParams.get('paginate') === 'true'

    const where = schoolWhere(session)

    if (usePagination) {
      const params = getPaginationParams(request)
      const [expenses, total] = await Promise.all([
        prisma.expense.findMany({
          where,
          orderBy: { date: 'desc' },
          skip: params.skip,
          take: params.limit,
        }),
        prisma.expense.count({ where })
      ])

      return paginatedResponse(expenses.map(toPageExpense), total, params)
    } else {
      const expenses = await prisma.expense.findMany({
        where,
        orderBy: { date: 'desc' }
      })

      return successResponse(expenses.map(toPageExpense))
    }
  },
  { requireAuth: true, module: 'finance' }
)

export const POST = withApiHandler(
  async (request: NextRequest, context, session) => {
    const body = await readJson(request)

    // Non-super-admins always write to their own school
    const schoolId = await resolveSchoolId(session, body.schoolId)
    if (!schoolId) {
      return errorResponse('School ID is required')
    }

    // The form sends amount as a string and no schoolId
    const { data, errors } = parseWith(expenseSchema, {
      ...normalizeExpenseBody(body),
      schoolId,
    })

    if (errors) {
      return validationErrorResponse(errors)
    }

    const expense = await prisma.expense.create({
      data: {
        schoolId,
        category: data.category,
        amount: data.amount,
        description: data.description,
        date: new Date(data.date),
        paidTo: data.paidTo,
        paymentMode: data.paymentMode,
        billNumber: data.billNumber,
        approvedBy: data.approvedBy,
      }
    })

    return successResponse(toPageExpense(expense), 201)
  },
  { requireAuth: true, module: 'finance' }
)
