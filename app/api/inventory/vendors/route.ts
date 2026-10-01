import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  getPaginationParams,
  paginatedResponse,
  successResponse,
  errorResponse,
  validationErrorResponse
} from '@/lib/api-utils'
import { vendorSchema } from '@/lib/validations'
import { schoolWhere, resolveSchoolId } from '@/lib/school-scope'
import { readJson, parseWith } from '@/lib/form-body'
import { normalizeVendorBody, toPageVendor } from './shared'

// Response shape of GET (unpaginated unless ?paginate=true):
// { success: true, data: Vendor[] } where each vendor carries its Prisma columns,
// `_count.purchaseOrders`, plus the page aliases `contact` and `category`.

export const GET = withApiHandler(
  async (request: NextRequest, context, session) => {
    const { searchParams } = new URL(request.url)
    const usePagination = searchParams.get('paginate') === 'true'

    const where = schoolWhere(session)

    if (usePagination) {
      const params = getPaginationParams(request)
      const [vendors, total] = await Promise.all([
        prisma.vendor.findMany({
          where,
          include: {
            _count: {
              select: { purchaseOrders: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: params.skip,
          take: params.limit,
        }),
        prisma.vendor.count({ where })
      ])

      return paginatedResponse(vendors.map(toPageVendor), total, params)
    } else {
      const vendors = await prisma.vendor.findMany({
        where,
        include: {
          _count: {
            select: { purchaseOrders: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      })

      return successResponse(vendors.map(toPageVendor))
    }
  },
  { requireAuth: true, module: 'inventory' }
)

export const POST = withApiHandler(
  async (request: NextRequest, context, session) => {
    const body = await readJson(request)

    // Non-super-admins always write to their own school
    const schoolId = await resolveSchoolId(session, body.schoolId)
    if (!schoolId) {
      return errorResponse('School ID is required')
    }

    const input = normalizeVendorBody(body)

    // The vendors page has no code field: generate the next free VEN-### code
    if (!input.code) {
      const existingCodes = new Set(
        (await prisma.vendor.findMany({ where: { schoolId }, select: { code: true } })).map(
          (vendor) => vendor.code
        )
      )
      let sequence = existingCodes.size + 1
      while (existingCodes.has(`VEN-${String(sequence).padStart(3, '0')}`)) sequence++
      input.code = `VEN-${String(sequence).padStart(3, '0')}`
    }

    const { data, errors } = parseWith(vendorSchema, { ...input, schoolId })

    if (errors) {
      return validationErrorResponse(errors)
    }

    const duplicate = await prisma.vendor.findFirst({
      where: { schoolId, code: data.code },
      select: { id: true },
    })
    if (duplicate) {
      return errorResponse('A vendor with this code already exists')
    }

    const vendor = await prisma.vendor.create({
      data: {
        schoolId,
        name: data.name,
        code: data.code,
        contactPerson: data.contactPerson,
        phone: data.phone,
        email: data.email || null,
        address: data.address,
        gst: data.gst,
        isActive: data.isActive,
      },
      include: {
        _count: {
          select: { purchaseOrders: true }
        }
      }
    })

    return successResponse(toPageVendor(vendor), 201)
  },
  { requireAuth: true, module: 'inventory' }
)
