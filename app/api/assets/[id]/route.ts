import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  getSchoolFilter,
  successResponse,
  notFoundResponse,
  errorResponse,
  validationErrorResponse,
} from '@/lib/api-utils'
import { assetSchema } from '@/lib/validations'
import { readJson, parseWith, str, num } from '@/lib/form-body'

// schoolId is never changed on update
const assetUpdateSchema = assetSchema.partial().omit({ schoolId: true })

// GET /api/assets/[id] - Get a specific asset
export const GET = withApiHandler(
  async (request: NextRequest, { params }, session) => {
    const asset = await prisma.asset.findFirst({
      where: {
        id: params.id,
        ...getSchoolFilter(session),
      },
    })

    if (!asset) {
      return notFoundResponse('Asset not found')
    }

    return successResponse(asset)
  },
  { requireAuth: true, module: 'inventory' }
)

// PUT /api/assets/[id] - Update an asset
export const PUT = withApiHandler(
  async (request: NextRequest, { params }, session) => {
    // Check if asset exists and belongs to user's school
    const existingAsset = await prisma.asset.findFirst({
      where: {
        id: params.id,
        ...getSchoolFilter(session),
      },
    })

    if (!existingAsset) {
      return notFoundResponse('Asset not found')
    }

    // The form sends null for blank prices and '' for blank text inputs
    const body = await readJson(request)
    const { data, errors } = parseWith(assetUpdateSchema, {
      ...(body.name !== undefined && { name: str(body.name) ?? '' }),
      ...(body.code !== undefined && { code: str(body.code) ?? '' }),
      ...(body.assetType !== undefined && { assetType: body.assetType }),
      ...(body.description !== undefined && { description: str(body.description) }),
      ...(body.location !== undefined && { location: str(body.location) }),
      ...(body.condition !== undefined && { condition: str(body.condition) }),
      ...(str(body.purchasePrice) !== null && { purchasePrice: num(body.purchasePrice) }),
      ...(str(body.currentValue) !== null && { currentValue: num(body.currentValue) }),
      ...(typeof body.isDurable === 'boolean' && { isDurable: body.isDurable }),
      ...(typeof body.isActive === 'boolean' && { isActive: body.isActive }),
    })

    if (errors) {
      return validationErrorResponse(errors)
    }

    if (data.code !== undefined && data.code !== existingAsset.code) {
      const duplicate = await prisma.asset.findFirst({
        where: { schoolId: existingAsset.schoolId, code: data.code, id: { not: existingAsset.id } },
        select: { id: true },
      })
      if (duplicate) {
        return errorResponse('An asset with this code already exists')
      }
    }

    // Blank price inputs clear the stored value. purchaseDate is only changed when
    // sent explicitly as a date string (the page stamps "now" on every save).
    const clearedPrices = {
      ...((body.purchasePrice === null || body.purchasePrice === '') && { purchasePrice: null }),
      ...((body.currentValue === null || body.currentValue === '') && { currentValue: null }),
    }

    const asset = await prisma.asset.update({
      where: { id: params.id },
      data: { ...data, ...clearedPrices },
    })

    return successResponse(asset)
  },
  { requireAuth: true, module: 'inventory' }
)

// DELETE /api/assets/[id] - Delete an asset
export const DELETE = withApiHandler(
  async (request: NextRequest, { params }, session) => {
    // Check if asset exists and belongs to user's school
    const asset = await prisma.asset.findFirst({
      where: {
        id: params.id,
        ...getSchoolFilter(session),
      },
    })

    if (!asset) {
      return notFoundResponse('Asset not found')
    }

    await prisma.asset.delete({
      where: { id: params.id },
    })

    return successResponse({ success: true, message: 'Asset deleted successfully' })
  },
  { requireAuth: true, module: 'inventory' }
)
