import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  getSchoolFilter,
  successResponse,
  errorResponse,
  validationErrorResponse,
} from '@/lib/api-utils'
import { assetSchema } from '@/lib/validations'
import { resolveSchoolId } from '@/lib/school-scope'
import { readJson, parseWith, str, num } from '@/lib/form-body'

// GET /api/assets - Get all assets
export const GET = withApiHandler(
  async (request: NextRequest, context, session) => {
    const assets = await prisma.asset.findMany({
      where: getSchoolFilter(session),
      orderBy: { createdAt: 'desc' },
    })

    return successResponse(assets)
  },
  { requireAuth: true, module: 'inventory' }
)

// POST /api/assets - Create a new asset
export const POST = withApiHandler(
  async (request: NextRequest, context, session) => {
    const body = await readJson(request)

    // Non-super-admins always write to their own school
    const schoolId = await resolveSchoolId(session, body.schoolId)

    if (!schoolId) {
      return validationErrorResponse({
        schoolId: ['School ID is required'],
      })
    }

    // The form sends null for blank prices and '' for blank text inputs
    const { data, errors } = parseWith(assetSchema, {
      ...body,
      schoolId,
      name: str(body.name) ?? '',
      code: str(body.code) ?? '',
      description: str(body.description),
      location: str(body.location),
      condition: str(body.condition),
      purchaseDate: str(body.purchaseDate) ?? undefined,
      purchasePrice: num(body.purchasePrice),
      currentValue: num(body.currentValue),
    })

    if (errors) {
      return validationErrorResponse(errors)
    }

    const duplicate = await prisma.asset.findFirst({
      where: { schoolId, code: data.code },
      select: { id: true },
    })
    if (duplicate) {
      return errorResponse('An asset with this code already exists')
    }

    const asset = await prisma.asset.create({
      data: {
        schoolId,
        name: data.name,
        code: data.code,
        assetType: data.assetType,
        description: data.description,
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : undefined,
        purchasePrice: data.purchasePrice,
        currentValue: data.currentValue,
        location: data.location,
        condition: data.condition,
        isDurable: data.isDurable,
        isActive: data.isActive,
      },
    })

    return successResponse(asset, 201)
  },
  { requireAuth: true, module: 'inventory' }
)
