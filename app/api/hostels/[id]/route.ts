import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  getSchoolFilter,
  successResponse,
  errorResponse,
  validationErrorResponse,
  notFoundResponse,
} from '@/lib/api-utils'
import { hostelSchema } from '@/lib/validations'
import { readJson, parseWith, str, num } from '@/lib/form-body'

const hostelUpdateSchema = hostelSchema.partial().omit({ schoolId: true })

export const GET = withApiHandler(
  async (_request: NextRequest, context, session) => {
    const { id } = context.params
    const schoolFilter = getSchoolFilter(session)

    const hostel = await prisma.hostel.findFirst({
      where: {
        id,
        ...schoolFilter,
      },
      include: {
        floors: {
          include: {
            rooms: {
              include: {
                beds: true,
              },
            },
          },
        },
        students: true,
      },
    })

    if (!hostel) {
      return notFoundResponse('Hostel not found')
    }

    return successResponse(hostel)
  },
  { requireAuth: true, module: 'hostel' }
)

export const PUT = withApiHandler(
  async (request: NextRequest, context, session) => {
    const { id } = context.params
    const schoolFilter = getSchoolFilter(session)

    // Check if hostel exists and belongs to user's school
    const existingHostel = await prisma.hostel.findFirst({
      where: {
        id,
        ...schoolFilter,
      },
    })

    if (!existingHostel) {
      return notFoundResponse('Hostel not found')
    }

    // schoolId is never changed on update. Blank optional inputs clear the field.
    const body = await readJson(request)
    const { data, errors } = parseWith(hostelUpdateSchema, {
      ...(body.name !== undefined && { name: str(body.name) ?? '' }),
      ...(body.code !== undefined && { code: str(body.code) ?? '' }),
      ...(body.address !== undefined && { address: str(body.address) }),
      ...(body.warden !== undefined && { warden: str(body.warden) }),
      ...(body.phone !== undefined && { phone: str(body.phone) }),
      ...(body.capacity !== undefined && { capacity: num(body.capacity) }),
      ...(typeof body.isActive === 'boolean' && { isActive: body.isActive }),
    })

    if (errors) {
      return validationErrorResponse(errors)
    }

    if (data.code !== undefined || data.name !== undefined) {
      const duplicate = await prisma.hostel.findFirst({
        where: {
          schoolId: existingHostel.schoolId,
          id: { not: id },
          OR: [
            ...(data.code !== undefined ? [{ code: data.code }] : []),
            ...(data.name !== undefined ? [{ name: data.name }] : []),
          ],
        },
      })
      if (duplicate) {
        return duplicate.code === data.code
          ? errorResponse('A hostel with this code already exists')
          : errorResponse('A hostel with this name already exists')
      }
    }

    const hostel = await prisma.hostel.update({
      where: { id },
      data,
      include: {
        _count: { select: { students: true, floors: true } },
      },
    })

    return successResponse(hostel)
  },
  { requireAuth: true, module: 'hostel' }
)

export const DELETE = withApiHandler(
  async (_request: NextRequest, context, session) => {
    const { id } = context.params
    const schoolFilter = getSchoolFilter(session)

    // Check if hostel exists and belongs to user's school
    const existingHostel = await prisma.hostel.findFirst({
      where: {
        id,
        ...schoolFilter,
      },
    })

    if (!existingHostel) {
      return notFoundResponse('Hostel not found')
    }

    // Student allocations reference the hostel (and its beds) without cascade
    const allocations = await prisma.studentHostel.count({ where: { hostelId: id } })
    if (allocations > 0) {
      return errorResponse(
        `Cannot delete hostel: ${allocations} student allocation(s) exist. Remove them first.`
      )
    }

    await prisma.hostel.delete({
      where: { id },
    })

    return successResponse({ success: true })
  },
  { requireAuth: true, module: 'hostel' }
)
