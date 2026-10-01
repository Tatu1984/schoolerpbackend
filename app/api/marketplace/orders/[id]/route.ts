import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  getSchoolFilter,
  successResponse,
  notFoundResponse,
  validationErrorResponse,
  validateBody,
  AuthenticatedSession,
} from '@/lib/api-utils'
import { marketplaceOrderSchema } from '@/lib/validations'
import { z } from 'zod'

export const GET = withApiHandler(
  async (_request: NextRequest, context, session: AuthenticatedSession | null) => {
    const schoolFilter = getSchoolFilter(session)
    const { id } = context.params

    const where: any = { id }

    // Apply school filter through student relation
    if (schoolFilter.schoolId) {
      where.student = {
        schoolId: schoolFilter.schoolId,
      }
    }

    const order = await prisma.marketplaceOrder.findFirst({
      where,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
            schoolId: true,
          },
        },
        items: {
          include: {
            product: true,
          },
        },
      },
    })

    if (!order) {
      return notFoundResponse('Order not found')
    }

    return successResponse(order)
  },
  { requireAuth: true, module: 'marketplace' }
)

export const PUT = withApiHandler(
  async (request: NextRequest, context, session: AuthenticatedSession | null) => {
    const { id } = context.params
    const schoolFilter = getSchoolFilter(session)

    // Check if order exists and belongs to user's school
    const where: any = { id }
    if (schoolFilter.schoolId) {
      where.student = {
        schoolId: schoolFilter.schoolId,
      }
    }

    const existingOrder = await prisma.marketplaceOrder.findFirst({
      where,
      include: {
        items: true,
      },
    })

    if (!existingOrder) {
      return notFoundResponse('Order not found')
    }

    // Define update schema (only allow updating certain fields)
    const updateSchema = z.object({
      status: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']).optional(),
      paymentMode: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'UPI', 'CHEQUE']).optional(),
      shippingAddress: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    })

    const { data, errors } = await validateBody(request, updateSchema)

    if (errors) {
      return validationErrorResponse(errors)
    }

    // If cancelling order, restore product stock
    if (data!.status === 'CANCELLED' && existingOrder.status !== 'CANCELLED') {
      await prisma.$transaction(
        existingOrder.items.map((item: { productId: string; quantity: number }) =>
          prisma.product.update({
            where: { id: item.productId },
            data: {
              stock: {
                increment: item.quantity,
              },
            },
          })
        )
      )
    }

    // MarketplaceOrder has no paymentMode/notes columns - only persist what exists
    const order = await prisma.marketplaceOrder.update({
      where: { id },
      data: {
        status: data!.status,
        shippingAddress: data!.shippingAddress,
        ...(data!.status === 'DELIVERED' && !existingOrder.deliveryDate ? { deliveryDate: new Date() } : {}),
      },
      include: {
        student: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    })

    return successResponse(order)
  },
  { requireAuth: true, module: 'marketplace' }
)

export const DELETE = withApiHandler(
  async (_request: NextRequest, context, session: AuthenticatedSession | null) => {
    const { id } = context.params
    const schoolFilter = getSchoolFilter(session)

    // Check if order exists and belongs to user's school
    const where: any = { id }
    if (schoolFilter.schoolId) {
      where.student = {
        schoolId: schoolFilter.schoolId,
      }
    }

    const existingOrder = await prisma.marketplaceOrder.findFirst({
      where,
      include: {
        items: true,
      },
    })

    if (!existingOrder) {
      return notFoundResponse('Order not found')
    }

    // Restore product stock before deleting
    await prisma.$transaction([
      ...existingOrder.items.map((item: { productId: string; quantity: number }) =>
        prisma.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              increment: item.quantity,
            },
          },
        })
      ),
      // Delete order items first
      prisma.marketplaceOrderItem.deleteMany({
        where: { orderId: id },
      }),
      // Then delete the order
      prisma.marketplaceOrder.delete({
        where: { id },
      }),
    ])

    return successResponse({ message: 'Order deleted successfully' })
  },
  { requireAuth: true, module: 'marketplace' }
)
