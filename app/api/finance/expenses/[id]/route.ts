import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  successResponse,
  notFoundResponse,
  validationErrorResponse,
} from '@/lib/api-utils'
import { expenseSchema } from '@/lib/validations'
import { schoolWhere } from '@/lib/school-scope'
import { readJson, parseWith } from '@/lib/form-body'
import { normalizeExpenseBody, toPageExpense } from '../shared'

const expenseUpdateSchema = expenseSchema.partial().omit({ schoolId: true })

// GET /api/finance/expenses/[id]
export const GET = withApiHandler(
  async (_request: NextRequest, { params }, session) => {
    const expense = await prisma.expense.findFirst({
      where: { id: params.id, ...schoolWhere(session) },
    })

    if (!expense) {
      return notFoundResponse('Expense not found')
    }

    return successResponse(toPageExpense(expense))
  },
  { requireAuth: true, module: 'finance' }
)

// PUT /api/finance/expenses/[id]
export const PUT = withApiHandler(
  async (request: NextRequest, { params }, session) => {
    const existing = await prisma.expense.findFirst({
      where: { id: params.id, ...schoolWhere(session) },
      select: { id: true },
    })

    if (!existing) {
      return notFoundResponse('Expense not found')
    }

    const { data, errors } = parseWith(
      expenseUpdateSchema,
      normalizeExpenseBody(await readJson(request))
    )

    if (errors) {
      return validationErrorResponse(errors)
    }

    const { date, ...fields } = data

    const expense = await prisma.expense.update({
      where: { id: existing.id },
      data: { ...fields, ...(date && { date: new Date(date) }) },
    })

    return successResponse(toPageExpense(expense))
  },
  { requireAuth: true, module: 'finance' }
)

// DELETE /api/finance/expenses/[id]
export const DELETE = withApiHandler(
  async (_request: NextRequest, { params }, session) => {
    const existing = await prisma.expense.findFirst({
      where: { id: params.id, ...schoolWhere(session) },
      select: { id: true },
    })

    if (!existing) {
      return notFoundResponse('Expense not found')
    }

    await prisma.expense.delete({ where: { id: existing.id } })

    return successResponse({ message: 'Expense deleted successfully' })
  },
  { requireAuth: true, module: 'finance' }
)
