import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  getSchoolFilter,
  getPaginationParams,
  successResponse,
  paginatedResponse,
  AuthenticatedSession,
} from '@/lib/api-utils'

interface InventoryItem {
  id: string
  name: string
  productName: string
  sku: string
  reorderLevel: number
  category: string
  stock: number
  price: number
  isActive: boolean
  lowStockAlert: boolean
  totalValue: number
}

interface ProductResult {
  id: string
  name: string
  category: string
  stock: number
  price: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export const GET = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const schoolFilter = getSchoolFilter(session)
    const pagination = getPaginationParams(request)
    const { searchParams } = new URL(request.url)
    // The inventory page totals stock value from the full list
    if (!searchParams.has('limit')) {
      pagination.limit = 1000
      pagination.skip = (pagination.page - 1) * pagination.limit
    }

    const where: any = {
      ...schoolFilter,
      isActive: true,
    }

    // Optional filters
    const category = searchParams.get('category')
    if (category) {
      where.category = category
    }

    const lowStock = searchParams.get('lowStock')
    const stockThreshold = parseInt(searchParams.get('threshold') || '10', 10)

    if (lowStock === 'true') {
      where.stock = {
        lte: stockThreshold,
      }
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { stock: 'asc' },
        select: {
          id: true,
          name: true,
          category: true,
          stock: true,
          price: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.product.count({ where }),
    ])

    // Transform products to inventory items with additional calculations
    const inventoryItems: InventoryItem[] = products.map((product: ProductResult) => ({
      id: product.id,
      name: product.name,
      // Fields the inventory page renders. Product has no SKU or reorder-level
      // column: the SKU is derived from the id and the reorder level is the
      // low-stock threshold (?threshold=, default 10).
      productName: product.name,
      sku: `SKU-${product.id.slice(-6).toUpperCase()}`,
      reorderLevel: stockThreshold,
      category: product.category,
      stock: product.stock,
      price: product.price,
      isActive: product.isActive,
      lowStockAlert: product.stock <= stockThreshold,
      totalValue: product.stock * product.price,
    }))

    // Calculate summary statistics
    const summary = {
      totalProducts: total,
      totalValue: inventoryItems.reduce((sum, item) => sum + item.totalValue, 0),
      lowStockCount: inventoryItems.filter((item) => item.lowStockAlert).length,
      outOfStockCount: inventoryItems.filter((item) => item.stock === 0).length,
    }

    const response = paginatedResponse(inventoryItems, total, pagination)
    response.headers.set('X-Inventory-Summary', JSON.stringify(summary))
    return response
  },
  { requireAuth: true, module: 'marketplace' }
)
