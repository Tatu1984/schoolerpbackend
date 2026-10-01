import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  getSchoolFilter,
  successResponse,
  validationErrorResponse,
  notFoundResponse,
  AuthenticatedSession,
} from '@/lib/api-utils'
import { z } from 'zod'

const updateOrderSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED']).optional(),
  deliveryTime: z.string().refine((value) => !isNaN(Date.parse(value)), 'Invalid date').optional(),
  notes: z.string().optional(),
})

export const GET = withApiHandler(
  async (_request: NextRequest, context, session: AuthenticatedSession | null) => {
    const { id } = context.params
    const schoolFilter = getSchoolFilter(session)

    const where: any = { id }

    // Filter by school through student relationship
    if (schoolFilter.schoolId) {
      where.student = {
        schoolId: schoolFilter.schoolId,
      }
    }

    const order = await prisma.canteenOrder.findFirst({
      where,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            rollNumber: true,
            class: {
              select: {
                name: true,
                grade: true,
              },
            },
          },
        },
        items: {
          include: {
            menuItem: {
              select: {
                id: true,
                name: true,
                category: true,
                price: true,
              },
            },
          },
        },
      },
    })

    if (!order) {
      return notFoundResponse('Order not found')
    }

    return successResponse(order)
  },
  { requireAuth: true, module: 'canteen' }
)

export const PUT = withApiHandler(
  async (request: NextRequest, context, session: AuthenticatedSession | null) => {
    const { id } = context.params
    const schoolFilter = getSchoolFilter(session)

    // Check if order exists and belongs to school
    const where: any = { id }

    if (schoolFilter.schoolId) {
      where.student = {
        schoolId: schoolFilter.schoolId,
      }
    }

    const existingOrder = await prisma.canteenOrder.findFirst({
      where,
    })

    if (!existingOrder) {
      return notFoundResponse('Order not found')
    }

    const { data, errors } = await validateBody(request, updateOrderSchema)

    if (errors) {
      return validationErrorResponse(errors)
    }

    const order = await prisma.canteenOrder.update({
      where: { id },
      data: {
        status: data!.status,
        notes: data!.notes,
        // stamp the hand-over time when an order is marked delivered
        deliveryTime: data!.deliveryTime
          ? new Date(data!.deliveryTime)
          : data!.status === 'DELIVERED' && !existingOrder.deliveryTime
            ? new Date()
            : undefined,
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
        items: {
          include: {
            menuItem: {
              select: {
                id: true,
                name: true,
                category: true,
              },
            },
          },
        },
      },
    })

    return successResponse(order)
  },
  { requireAuth: true, module: 'canteen' }
)

export const DELETE = withApiHandler(
  async (_request: NextRequest, context, session: AuthenticatedSession | null) => {
    const { id } = context.params
    const schoolFilter = getSchoolFilter(session)

    // Check if order exists and belongs to school
    const where: any = { id }

    if (schoolFilter.schoolId) {
      where.student = {
        schoolId: schoolFilter.schoolId,
      }
    }

    const existingOrder = await prisma.canteenOrder.findFirst({
      where,
    })

    if (!existingOrder) {
      return notFoundResponse('Order not found')
    }

    // Only allow deletion if order is PENDING or CANCELLED
    if (!['PENDING', 'CANCELLED'].includes(existingOrder.status)) {
      return validationErrorResponse({
        status: ['Cannot delete order that is being prepared or delivered'],
      })
    }

    await prisma.canteenOrder.delete({
      where: { id },
    })

    return successResponse({ success: true })
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
