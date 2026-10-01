import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
} from '@/lib/api-utils'
import { vendorSchema } from '@/lib/validations'
import { schoolWhere } from '@/lib/school-scope'
import { readJson, parseWith } from '@/lib/form-body'
import { normalizeVendorBody, toPageVendor } from '../shared'

const vendorUpdateSchema = vendorSchema.partial().omit({ schoolId: true })

const vendorInclude = { _count: { select: { purchaseOrders: true } } } as const

// GET /api/inventory/vendors/[id]
export const GET = withApiHandler(
  async (_request: NextRequest, { params }, session) => {
    const vendor = await prisma.vendor.findFirst({
      where: { id: params.id, ...schoolWhere(session) },
      include: vendorInclude,
    })

    if (!vendor) {
      return notFoundResponse('Vendor not found')
    }

    return successResponse(toPageVendor(vendor))
  },
  { requireAuth: true, module: 'inventory' }
)

// PUT /api/inventory/vendors/[id]
export const PUT = withApiHandler(
  async (request: NextRequest, { params }, session) => {
    const existing = await prisma.vendor.findFirst({
      where: { id: params.id, ...schoolWhere(session) },
    })

    if (!existing) {
      return notFoundResponse('Vendor not found')
    }

    const { data, errors } = parseWith(
      vendorUpdateSchema,
      normalizeVendorBody(await readJson(request))
    )

    if (errors) {
      return validationErrorResponse(errors)
    }

    if (data.code !== undefined && data.code !== existing.code) {
      const duplicate = await prisma.vendor.findFirst({
        where: { schoolId: existing.schoolId, code: data.code, id: { not: existing.id } },
        select: { id: true },
      })
      if (duplicate) {
        return errorResponse('A vendor with this code already exists')
      }
    }

    const vendor = await prisma.vendor.update({
      where: { id: existing.id },
      data: { ...data, ...(data.email !== undefined && { email: data.email || null }) },
      include: vendorInclude,
    })

    return successResponse(toPageVendor(vendor))
  },
  { requireAuth: true, module: 'inventory' }
)

// DELETE /api/inventory/vendors/[id]
export const DELETE = withApiHandler(
  async (_request: NextRequest, { params }, session) => {
    const existing = await prisma.vendor.findFirst({
      where: { id: params.id, ...schoolWhere(session) },
      include: vendorInclude,
    })

    if (!existing) {
      return notFoundResponse('Vendor not found')
    }

    // Purchase orders reference the vendor without cascade
    if (existing._count.purchaseOrders > 0) {
      return errorResponse(
        `Cannot delete vendor: ${existing._count.purchaseOrders} purchase order(s) reference it.`
      )
    }

    await prisma.vendor.delete({ where: { id: existing.id } })

    return successResponse({ message: 'Vendor deleted successfully' })
  },
  { requireAuth: true, module: 'inventory' }
)
