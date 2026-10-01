import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withApiHandler, successResponse, errorResponse } from '@/lib/api-utils'
import { schoolWhere, parseDate } from '@/lib/school-scope'
import {
  purchaseOrderInclude,
  toPurchaseOrderRow,
  parsePurchaseOrderStatus,
  parseOrderLine,
} from '@/lib/purchase-orders'

// GET /api/inventory/purchase-orders
export const GET = withApiHandler(
  async (request: NextRequest, _context, session) => {
    const { searchParams } = new URL(request.url)
    const status = parsePurchaseOrderStatus(searchParams.get('status'))
    const vendorId = searchParams.get('vendorId')

    const orders = await prisma.purchaseOrder.findMany({
      where: {
        ...schoolWhere(session),
        ...(status && { status }),
        ...(vendorId && { vendorId }),
      },
      include: purchaseOrderInclude,
      orderBy: { orderDate: 'desc' },
      take: 1000,
    })

    return successResponse(orders.map(toPurchaseOrderRow))
  },
  { requireAuth: true, module: 'inventory' }
)

// POST /api/inventory/purchase-orders
// Body: { poNumber?, vendorId, items, quantity, price, status?, orderDate?, notes? }
export const POST = withApiHandler(
  async (request: NextRequest, _context, session) => {
    const body = await request.json().catch(() => null)
    if (!body) return errorResponse('Invalid request body')
    if (!body.vendorId) return errorResponse('Vendor is required')

    // The order always belongs to the vendor's school, and the vendor must be visible to the caller.
    const vendor = await prisma.vendor.findFirst({
      where: { id: String(body.vendorId), ...schoolWhere(session) },
      select: { id: true, schoolId: true },
    })
    if (!vendor) return errorResponse('Vendor not found', 404)

    const { line, error } = parseOrderLine(body)
    if (!line) return errorResponse(error || 'Invalid order line')

    const status = body.status ? parsePurchaseOrderStatus(body.status) : 'PENDING'
    if (!status) return errorResponse('Invalid purchase order status')

    const orderDate = parseDate(body.orderDate)
    if (orderDate === undefined) return errorResponse('Invalid order date')

    const orderNumber =
      String(body.poNumber ?? body.orderNumber ?? '').trim() ||
      `PO-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`

    const duplicate = await prisma.purchaseOrder.findFirst({
      where: { schoolId: vendor.schoolId, orderNumber },
      select: { id: true },
    })
    if (duplicate) return errorResponse(`Purchase order number ${orderNumber} already exists`)

    const approved = status === 'APPROVED' || status === 'COMPLETED'

    const order = await prisma.purchaseOrder.create({
      data: {
        schoolId: vendor.schoolId,
        vendorId: vendor.id,
        orderNumber,
        orderDate: orderDate || new Date(),
        totalAmount: line.totalPrice,
        status,
        approvedBy: approved ? session?.user.name || session?.user.email || null : null,
        approvalDate: approved ? new Date() : null,
        notes: body.notes ? String(body.notes) : null,
        items: { create: [line] },
      },
      include: purchaseOrderInclude,
    })

    return successResponse(toPurchaseOrderRow(order), 201)
  },
  { requireAuth: true, module: 'inventory' }
)
