import { Prisma, PurchaseOrderStatus } from '@prisma/client'
import { parseNumber } from '@/lib/school-scope'

export const purchaseOrderInclude = {
  vendor: { select: { id: true, name: true, code: true, contactPerson: true, phone: true } },
  items: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.PurchaseOrderInclude

type OrderWithRelations = Prisma.PurchaseOrderGetPayload<{ include: typeof purchaseOrderInclude }>

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * The purchase-order screen works with a flat row
 * (poNumber, items, quantity, price, status) while the database stores
 * PurchaseOrder + PurchaseOrderItem lines. This flattens one into the other;
 * the structured lines are still returned as `lineItems`.
 */
export function toPurchaseOrderRow(order: OrderWithRelations) {
  const quantity = order.items.reduce((sum, i) => sum + i.quantity, 0)
  const price =
    order.items.length === 1
      ? order.items[0].unitPrice
      : quantity > 0
        ? round2(order.totalAmount / quantity)
        : order.totalAmount

  return {
    id: order.id,
    schoolId: order.schoolId,
    poNumber: order.orderNumber,
    orderNumber: order.orderNumber,
    vendorId: order.vendorId,
    vendor: order.vendor,
    items: order.items.map((i) => i.itemName).join(', '),
    quantity,
    price,
    totalAmount: order.totalAmount,
    status: displayPurchaseOrderStatus(order.status),
    orderDate: order.orderDate,
    approvedBy: order.approvedBy,
    approvalDate: order.approvalDate,
    notes: order.notes,
    lineItems: order.items,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  }
}

// The screen calls a delivered order RECEIVED; the schema enum calls it COMPLETED.
export function parsePurchaseOrderStatus(value: unknown): PurchaseOrderStatus | null {
  const key = String(value || '').trim().toUpperCase()
  if (key === 'RECEIVED') return 'COMPLETED'
  return key in PurchaseOrderStatus ? (key as PurchaseOrderStatus) : null
}

export function displayPurchaseOrderStatus(status: PurchaseOrderStatus): string {
  return status === 'COMPLETED' ? 'RECEIVED' : status
}

/** Reads the single line the form describes: items (text), quantity, price (unit). */
export function parseOrderLine(body: Record<string, unknown>): {
  line?: { itemName: string; quantity: number; unitPrice: number; totalPrice: number }
  error?: string
} {
  const itemName = String(body.items ?? body.itemName ?? '').trim()
  if (!itemName) return { error: 'Items are required' }

  const quantity = parseNumber(body.quantity)
  if (quantity === null || quantity <= 0 || !Number.isInteger(quantity)) {
    return { error: 'Quantity must be a whole number greater than zero' }
  }
  const unitPrice = parseNumber(body.price ?? body.unitPrice)
  if (unitPrice === null || unitPrice < 0) return { error: 'Price must be zero or more' }

  return { line: { itemName, quantity, unitPrice, totalPrice: round2(quantity * unitPrice) } }
}
