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
import { productSchema } from '@/lib/validations'

export const GET = withApiHandler(
  async (_request: NextRequest, context, session: AuthenticatedSession | null) => {
    const schoolFilter = getSchoolFilter(session)
    const { id } = context.params

    const product = await prisma.product.findFirst({
      where: {
        id,
        ...schoolFilter,
      },
    })

    if (!product) {
      return notFoundResponse('Product not found')
    }

    return successResponse(product)
  },
  { requireAuth: true, module: 'marketplace' }
)

export const PUT = withApiHandler(
  async (request: NextRequest, context, session: AuthenticatedSession | null) => {
    const { id } = context.params
    const schoolFilter = getSchoolFilter(session)

    // Check if product exists and belongs to user's school
    const existingProduct = await prisma.product.findFirst({
      where: {
        id,
        ...schoolFilter,
      },
    })

    if (!existingProduct) {
      return notFoundResponse('Product not found')
    }

    // Validate the update data (partial schema)
    const partialSchema = productSchema.partial()
    const { data, errors } = await validateBody(request, partialSchema)

    if (errors) {
      return validationErrorResponse(errors)
    }

    // Remove schoolId from update data if present (can't change school)
    const { schoolId, ...updateData } = data as any

    const product = await prisma.product.update({
      where: { id },
      data: updateData,
    })

    return successResponse(product)
  },
  { requireAuth: true, module: 'marketplace' }
)

export const DELETE = withApiHandler(
  async (_request: NextRequest, context, session: AuthenticatedSession | null) => {
    const { id } = context.params
    const schoolFilter = getSchoolFilter(session)

    // Check if product exists and belongs to user's school
    const existingProduct = await prisma.product.findFirst({
      where: {
        id,
        ...schoolFilter,
      },
    })

    if (!existingProduct) {
      return notFoundResponse('Product not found')
    }

    // Products that appear on past orders cannot be removed without breaking
    // those orders, so they are retired (hidden from the catalogue) instead.
    const orderLines = await prisma.marketplaceOrderItem.count({ where: { productId: id } })
    if (orderLines > 0) {
      await prisma.product.update({ where: { id }, data: { isActive: false } })
      return successResponse({ message: 'Product retired (it appears on existing orders)' })
    }

    await prisma.product.delete({
      where: { id },
    })

    return successResponse({ message: 'Product deleted successfully' })
  },
  { requireAuth: true, module: 'marketplace' }
)
