import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
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
import { canteenOrderSchema } from '@/lib/validations'

export const GET = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get('studentId')
    const status = searchParams.get('status')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const pagination = getPaginationParams(request)
    // The orders page shows the whole queue and counts statuses from the list
    if (!searchParams.has('limit')) {
      pagination.limit = 500
      pagination.skip = (pagination.page - 1) * pagination.limit
    }
    const sort = getSortParams(request, ['orderDate', 'totalAmount', 'status', 'createdAt'])

    const where: any = {}

    if (studentId) {
      where.studentId = studentId
    }

    if (status) {
      where.status = status
    }

    if (startDate || endDate) {
      where.orderDate = {}
      if (startDate) {
        where.orderDate.gte = new Date(startDate)
      }
      if (endDate) {
        where.orderDate.lte = new Date(endDate)
      }
    }

    // Filter by school through student relationship
    const schoolFilter = getSchoolFilter(session)
    if (schoolFilter.schoolId) {
      where.student = {
        schoolId: schoolFilter.schoolId,
      }
    }

    const [orders, total] = await Promise.all([
      prisma.canteenOrder.findMany({
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
              section: { select: { name: true } },
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
        orderBy: sort,
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.canteenOrder.count({ where }),
    ])

    // Flat fields the orders page renders
    const data = orders.map((order) => ({
      ...order,
      studentName: `${order.student.firstName} ${order.student.lastName}`.trim(),
      className: [order.student.class?.name, order.student.section?.name].filter(Boolean).join(' - '),
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    }))

    return paginatedResponse(data, total, pagination)
  },
  { requireAuth: true, module: 'canteen' }
)

export const POST = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const { data, errors } = await validateBody(request, canteenOrderSchema)

    if (errors) {
      return validationErrorResponse(errors)
    }

    // Verify student belongs to the school
    const schoolFilter = getSchoolFilter(session)
    if (schoolFilter.schoolId) {
      const student = await prisma.student.findFirst({
        where: {
          id: data!.studentId,
          schoolId: schoolFilter.schoolId,
        },
      })

      if (!student) {
        return validationErrorResponse({
          studentId: ['Student not found in your school'],
        })
      }
    }

    // Every item must be an available menu item of the student's school
    const student = await prisma.student.findUnique({
      where: { id: data!.studentId },
      select: { schoolId: true },
    })
    if (!student) {
      return validationErrorResponse({ studentId: ['Student not found'] })
    }
    const menuItemIds = Array.from(new Set(data!.items.map((item) => item.menuItemId)))
    const menuItems = await prisma.menuItem.count({
      where: { id: { in: menuItemIds }, schoolId: student.schoolId, isActive: true },
    })
    if (menuItems !== menuItemIds.length) {
      return validationErrorResponse({ items: ['One or more menu items were not found'] })
    }

    const duplicate = await prisma.canteenOrder.findUnique({
      where: { orderNumber: data!.orderNumber },
      select: { id: true },
    })
    if (duplicate) {
      return validationErrorResponse({ orderNumber: ['Order number already exists'] })
    }

    // CanteenOrder has no paymentMode column: only persist fields the model has
    const order = await prisma.canteenOrder.create({
      data: {
        orderNumber: data!.orderNumber,
        studentId: data!.studentId,
        totalAmount: data!.totalAmount,
        status: data!.status,
        notes: data!.notes,
        items: {
          create: data!.items.map((item) => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            price: item.price,
          })),
        },
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

    return successResponse(order, 201)
  },
  { requireAuth: true, module: 'canteen' }
)
