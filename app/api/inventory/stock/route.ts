import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  successResponse,
  AuthenticatedSession,
} from '@/lib/api-utils'
import { schoolWhere } from '@/lib/school-scope'

interface StockItem {
  id: string
  name: string
  sku: string
  category: string
  quantity: number
  reorderLevel: number
  unitPrice: number
  source: 'ASSET' | 'PURCHASE_ORDER'
}

// GET /api/inventory/stock
// There is no stock/inventory-item model, so stock levels are derived (read-only):
//  - every active asset is one unit (sku = asset code, category = asset type)
//  - items of COMPLETED purchase orders are summed per item name
// `reorderLevel` is not stored anywhere and is always 0.
export const GET = withApiHandler(
  async (_request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const where = schoolWhere(session)

    const [assets, purchasedItems] = await Promise.all([
      prisma.asset.findMany({
        where: { ...where, isActive: true },
        orderBy: { name: 'asc' },
      }),
      prisma.purchaseOrderItem.findMany({
        where: { purchaseOrder: { ...where, status: 'COMPLETED' } },
        orderBy: { createdAt: 'asc' },
      }),
    ])

    const stock: StockItem[] = assets.map((asset) => ({
      id: asset.id,
      name: asset.name,
      sku: asset.code,
      category: asset.assetType,
      quantity: 1,
      reorderLevel: 0,
      unitPrice: asset.currentValue ?? asset.purchasePrice ?? 0,
      source: 'ASSET',
    }))

    const purchased = new Map<string, StockItem>()
    for (const item of purchasedItems) {
      const key = item.itemName.trim().toLowerCase()
      const existing = purchased.get(key)
      if (existing) {
        existing.quantity += item.quantity
        existing.unitPrice = item.unitPrice // latest purchase price
      } else {
        purchased.set(key, {
          id: `po-item-${item.id}`,
          name: item.itemName.trim(),
          sku: `PO-${key.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').toUpperCase()}`,
          category: 'PURCHASED',
          quantity: item.quantity,
          reorderLevel: 0,
          unitPrice: item.unitPrice,
          source: 'PURCHASE_ORDER',
        })
      }
    }

    return successResponse([...stock, ...Array.from(purchased.values())])
  },
  { requireAuth: true, module: 'inventory' }
)
