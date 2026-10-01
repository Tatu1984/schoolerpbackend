import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { withApiHandler, successResponse, errorResponse, notFoundResponse } from '@/lib/api-utils'
import { schoolWhere, parseDate } from '@/lib/school-scope'
import {
  purchaseOrderInclude,
  toPurchaseOrderRow,
  parsePurchaseOrderStatus,
  parseOrderLine,
} from '@/lib/purchase-orders'

// GET /api/inventory/purchase-orders/[id]
export const GET = withApiHandler(
  async (_request: NextRequest, { params }, session) => {
    const order = await prisma.purchaseOrder.findFirst({
      where: { id: params.id, ...schoolWhere(session) },
      include: purchaseOrderInclude,
    })
    if (!order) return notFoundResponse('Purchase order not found')
    return successResponse(toPurchaseOrderRow(order))
  },
  { requireAuth: true, module: 'inventory' }
)

// PUT /api/inventory/purchase-orders/[id]
export const PUT = withApiHandler(
  async (request: NextRequest, { params }, session) => {
    const body = await request.json().catch(() => null)
    if (!body) return errorResponse('Invalid request body')

    const existing = await prisma.purchaseOrder.findFirst({
      where: { id: params.id, ...schoolWhere(session) },
      select: { id: true, schoolId: true, status: true, orderNumber: true, vendorId: true },
    })
    if (!existing) return notFoundResponse('Purchase order not found')

    const data: Prisma.PurchaseOrderUncheckedUpdateInput = {}

    if (body.vendorId && body.vendorId !== existing.vendorId) {
      const vendor = await prisma.vendor.findFirst({
        where: { id: String(body.vendorId), schoolId: existing.schoolId },
        select: { id: true },
      })
      if (!vendor) return errorResponse('Vendor not found', 404)
      data.vendorId = vendor.id
    }

    const orderNumber = String(body.poNumber ?? body.orderNumber ?? '').trim()
    if (orderNumber && orderNumber !== existing.orderNumber) {
      const duplicate = await prisma.purchaseOrder.findFirst({
        where: { schoolId: existing.schoolId, orderNumber, id: { not: existing.id } },
        select: { id: true },
      })
      if (duplicate) return errorResponse(`Purchase order number ${orderNumber} already exists`)
      data.orderNumber = orderNumber
    }

    if (body.status !== undefined) {
      const status = parsePurchaseOrderStatus(body.status)
      if (!status) return errorResponse('Invalid purchase order status')
      data.status = status
      if (status !== existing.status) {
        if (status === 'APPROVED' || (status === 'COMPLETED' && existing.status !== 'APPROVED')) {
          data.approvedBy = session?.user.name || session?.user.email || null
          data.approvalDate = new Date()
        } else if (status === 'PENDING') {
          data.approvedBy = null
          data.approvalDate = null
        }
      }
    }

    if (body.orderDate) {
      const orderDate = parseDate(body.orderDate)
      if (!orderDate) return errorResponse('Invalid order date')
      data.orderDate = orderDate
    }
    if (body.notes !== undefined) data.notes = body.notes ? String(body.notes) : null

    // The form edits the order as a single line; replace the lines only when it sent one.
    const sentLine = body.items !== undefined || body.quantity !== undefined || body.price !== undefined
    let line: ReturnType<typeof parseOrderLine>['line']
    if (sentLine) {
      const parsed = parseOrderLine(body)
      if (!parsed.line) return errorResponse(parsed.error || 'Invalid order line')
      line = parsed.line
      data.totalAmount = line.totalPrice
    }

    const order = await prisma.$transaction(async (tx) => {
      if (line) {
        await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: existing.id } })
        await tx.purchaseOrderItem.create({ data: { purchaseOrderId: existing.id, ...line } })
      }
      return tx.purchaseOrder.update({
        where: { id: existing.id },
        data,
        include: purchaseOrderInclude,
      })
    })

    return successResponse(toPurchaseOrderRow(order))
  },
  { requireAuth: true, module: 'inventory' }
)

// DELETE /api/inventory/purchase-orders/[id]
export const DELETE = withApiHandler(
  async (_request: NextRequest, { params }, session) => {
    const existing = await prisma.purchaseOrder.findFirst({
      where: { id: params.id, ...schoolWhere(session) },
      select: { id: true },
    })
    if (!existing) return notFoundResponse('Purchase order not found')

    // PurchaseOrderItem rows cascade.
    await prisma.purchaseOrder.delete({ where: { id: existing.id } })
    return successResponse({ id: existing.id })
  },
  { requireAuth: true, module: 'inventory' }
)
