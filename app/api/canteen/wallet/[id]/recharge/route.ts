import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import {
  withApiHandler,
  getSchoolFilter,
  successResponse,
  validationErrorResponse,
  notFoundResponse,
  AuthenticatedSession,
} from '@/lib/api-utils'
import { z } from 'zod'

const rechargeSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  paymentMode: z.enum(['CASH', 'CHEQUE', 'CARD', 'UPI', 'NET_BANKING', 'OTHER']).optional(),
  reference: z.string().optional(),
  description: z.string().optional(),
})

export const POST = withApiHandler(
  async (request: NextRequest, context, session: AuthenticatedSession | null) => {
    const { id } = context.params // This is the wallet ID
    const schoolFilter = getSchoolFilter(session)

    // Verify wallet exists and belongs to the school
    const walletWhere: any = {
      id,
      isActive: true,
    }

    if (schoolFilter.schoolId) {
      walletWhere.student = {
        schoolId: schoolFilter.schoolId,
      }
    }

    const wallet = await prisma.smartWallet.findFirst({
      where: walletWhere,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            rollNumber: true,
          },
        },
      },
    })

    if (!wallet) {
      return notFoundResponse('Wallet not found or inactive')
    }

    const { data, errors } = await validateBody(request, rechargeSchema)

    if (errors) {
      return validationErrorResponse(errors)
    }

    const { amount, paymentMode, reference, description } = data!

    // Create transaction and update wallet in a database transaction
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Create the transaction record
      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: id,
          type: 'CREDIT',
          amount,
          description: description || `Wallet recharge via ${paymentMode || 'cash'}`,
          reference: reference || undefined,
          balanceBefore: wallet.balance,
          balanceAfter: wallet.balance + amount,
        },
      })

      // Update wallet balance
      const updatedWallet = await tx.smartWallet.update({
        where: { id },
        data: {
          balance: { increment: amount },
        },
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              rollNumber: true,
            },
          },
        },
      })

      return {
        transaction,
        wallet: updatedWallet,
      }
    })

    return successResponse({
      success: true,
      message: 'Wallet recharged successfully',
      transaction: result.transaction,
      wallet: result.wallet,
    })
  },
  { requireAuth: true, module: 'canteen' }
)

async function validateBody<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>
): Promise<{ data: T | null; errors: Record<string, string[]> | null }> {
  try {
    const body = await request.json()
    const data = schema.parse(body)
    return { data, errors: null }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string[]> = {}
      error.errors.forEach((err) => {
        const path = err.path.join('.')
        if (!errors[path]) errors[path] = []
        errors[path].push(err.message)
      })
      return { data: null, errors }
    }
    return { data: null, errors: { _error: ['Invalid JSON body'] } }
  }
}
