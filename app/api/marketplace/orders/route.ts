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
  paginatedResponse,
  AuthenticatedSession,
} from '@/lib/api-utils'
import { marketplaceOrderSchema } from '@/lib/validations'

export const GET = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const schoolFilter = getSchoolFilter(session)
    const pagination = getPaginationParams(request)
    const { searchParams } = new URL(request.url)
    // The orders page shows every order and counts statuses from the list
    if (!searchParams.has('limit')) {
      pagination.limit = 500
      pagination.skip = (pagination.page - 1) * pagination.limit
    }

    const where: any = {}

    // Apply school filter through student relation
    if (schoolFilter.schoolId) {
      where.student = {
        schoolId: schoolFilter.schoolId,
      }
    }

    // Optional filters
    const studentId = searchParams.get('studentId')
    if (studentId) {
      where.studentId = studentId
    }

    const status = searchParams.get('status')
    if (status) {
      where.status = status
    }

    const [orders, total] = await Promise.all([
      prisma.marketplaceOrder.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              admissionNumber: true,
              phone: true,
              guardians: {
                select: { phone: true, isPrimary: true },
                orderBy: { isPrimary: 'desc' },
                take: 1,
              },
            },
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  category: true,
                },
              },
            },
          },
        },
      }),
      prisma.marketplaceOrder.count({ where }),
    ])

    // Flat fields the orders page renders. Orders are placed for a student, so
    // the "customer" is the student (phone falls back to the primary guardian).
    const data = orders.map((order) => {
      const { guardians, ...student } = order.student
      return {
        ...order,
        student,
        customerName: `${student.firstName} ${student.lastName}`.trim(),
        customerPhone: student.phone || guardians[0]?.phone || student.admissionNumber,
        itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      }
    })

    return paginatedResponse(data, total, pagination)
  },
  { requireAuth: true, module: 'marketplace' }
)

export const POST = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const { data, errors } = await validateBody(request, marketplaceOrderSchema)

    if (errors) {
      return validationErrorResponse(errors)
    }

    const schoolFilter = getSchoolFilter(session)

    // Verify student belongs to the user's school
    const student = await prisma.student.findUnique({
      where: { id: data!.studentId },
      select: { schoolId: true },
    })

    if (!student) {
      return validationErrorResponse({
        studentId: ['Student not found'],
      })
    }

    if (schoolFilter.schoolId && student.schoolId !== schoolFilter.schoolId) {
      return validationErrorResponse({
        studentId: ['You can only create orders for students in your school'],
      })
    }

    // Verify all products exist and have sufficient stock
    const productIds = data!.items.map((item) => item.productId)
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        isActive: true,
      },
    })

    if (products.length !== productIds.length) {
      return validationErrorResponse({
        items: ['One or more products not found or inactive'],
      })
    }

    // Check stock availability
    for (const item of data!.items) {
      const product = products.find((p: { id: string; stock: number; name: string }) => p.id === item.productId)
      if (product && product.stock < item.quantity) {
        return validationErrorResponse({
          items: [`Insufficient stock for product: ${product.name}`],
        })
      }
    }

    // Create order with items in a transaction
    const order = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Create the order
      const createdOrder = await tx.marketplaceOrder.create({
        data: {
          orderNumber: data!.orderNumber,
          studentId: data!.studentId,
          totalAmount: data!.totalAmount,
          status: data!.status || 'PENDING',
          shippingAddress: data!.shippingAddress,
        },
      })

      // Create order items and update product stock
      await Promise.all(
        data!.items.map(async (item) => {
          await tx.marketplaceOrderItem.create({
            data: {
              orderId: createdOrder.id,
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
            },
          })

          // Decrease product stock
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: {
                decrement: item.quantity,
              },
            },
          })
        })
      )

      // Return order with items
      return tx.marketplaceOrder.findUnique({
        where: { id: createdOrder.id },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          student: true,
        },
      })
    })

    return successResponse(order, 201)
  },
  { requireAuth: true, module: 'marketplace' }
)
