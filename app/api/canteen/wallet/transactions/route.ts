import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import {
  withApiHandler,
  getSchoolFilter,
  getPaginationParams,
  successResponse,
  validationErrorResponse,
  validateBody,
  AuthenticatedSession,
  paginatedResponse,
  getSortParams,
} from '@/lib/api-utils'
import { walletTransactionSchema } from '@/lib/validations'

export const GET = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const { searchParams } = new URL(request.url)
    const walletId = searchParams.get('walletId')
    const studentId = searchParams.get('studentId')
    const type = searchParams.get('type')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const pagination = getPaginationParams(request)
    // "Recent transactions" on the wallet page also feeds the recharges-today counter
    if (!searchParams.has('limit')) {
      pagination.limit = 100
      pagination.skip = (pagination.page - 1) * pagination.limit
    }
    const sort = getSortParams(request, ['createdAt', 'amount', 'type'])

    const where: any = {}

    if (walletId) {
      where.walletId = walletId
    }

    if (studentId) {
      where.wallet = {
        studentId,
      }
    }

    if (type) {
      where.type = type
    }

    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        where.createdAt.gte = new Date(startDate)
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate)
      }
    }

    // Filter by school through wallet->student relationship
    const schoolFilter = getSchoolFilter(session)
    if (schoolFilter.schoolId) {
      where.wallet = {
        ...where.wallet,
        student: {
          schoolId: schoolFilter.schoolId,
        },
      }
    }

    const [transactions, total] = await Promise.all([
      prisma.walletTransaction.findMany({
        where,
        include: {
          wallet: {
            select: {
              id: true,
              balance: true,
              student: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  rollNumber: true,
                },
              },
            },
          },
        },
        orderBy: sort,
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.walletTransaction.count({ where }),
    ])

    // The wallet page distinguishes money in ('RECHARGE') from money out.
    // The stored enum value stays available as `transactionType`.
    const data = transactions.map((transaction) => ({
      ...transaction,
      transactionType: transaction.type,
      type: transaction.type === 'DEBIT' ? 'DEBIT' : 'RECHARGE',
      studentName: `${transaction.wallet.student.firstName} ${transaction.wallet.student.lastName}`.trim(),
    }))

    return paginatedResponse(data, total, pagination)
  },
  { requireAuth: true, module: 'canteen' }
)

export const POST = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const { data, errors } = await validateBody(request, walletTransactionSchema)

    if (errors) {
      return validationErrorResponse(errors)
    }

    // Verify wallet exists and belongs to the school
    const schoolFilter = getSchoolFilter(session)
    const walletWhere: any = {
      id: data!.walletId,
    }

    if (schoolFilter.schoolId) {
      walletWhere.student = {
        schoolId: schoolFilter.schoolId,
      }
    }

    const wallet = await prisma.smartWallet.findFirst({
      where: walletWhere,
    })

    if (!wallet) {
      return validationErrorResponse({
        walletId: ['Wallet not found'],
      })
    }

    // Validate balance before/after
    if (data!.type === 'DEBIT' && wallet.balance < data!.amount) {
      return validationErrorResponse({
        amount: ['Insufficient balance'],
      })
    }

    // Create transaction and update wallet balance in a transaction
    const transaction = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const newTransaction = await tx.walletTransaction.create({
        data: data!,
        include: {
          wallet: {
            select: {
              id: true,
              balance: true,
              student: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  rollNumber: true,
                },
              },
            },
          },
        },
      })

      // Update wallet balance
      const newBalance = data!.balanceAfter
      await tx.smartWallet.update({
        where: { id: data!.walletId },
        data: { balance: newBalance },
      })

      return newTransaction
    })

    return successResponse(transaction, 201)
  },
  { requireAuth: true, module: 'canteen' }
)
