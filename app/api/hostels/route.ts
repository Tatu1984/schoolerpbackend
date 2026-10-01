import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  successResponse,
  errorResponse,
  validationErrorResponse,
  getPaginationParams,
  paginatedResponse,
  getSearchParams,
  getSchoolFilter,
  AuthenticatedSession,
} from '@/lib/api-utils'
import { hostelSchema } from '@/lib/validations'
import { resolveSchoolId } from '@/lib/school-scope'
import { readJson, parseWith, str, num } from '@/lib/form-body'
import { Prisma } from '@prisma/client'

export const GET = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const pagination = getPaginationParams(request)
    const searchParams = getSearchParams(request)
    const schoolFilter = getSchoolFilter(session)

    const where: Prisma.HostelWhereInput = {
      ...schoolFilter,
      ...(searchParams.search && {
        OR: [
          { name: { contains: searchParams.search, mode: 'insensitive' } },
          { warden: { contains: searchParams.search, mode: 'insensitive' } },
          { code: { contains: searchParams.search, mode: 'insensitive' } },
        ],
      }),
      ...(searchParams.isActive !== undefined && { isActive: searchParams.isActive === 'true' }),
    }

    const [hostels, total] = await Promise.all([
      prisma.hostel.findMany({
        where,
        include: {
          school: { select: { id: true, name: true } },
          _count: { select: { students: true, floors: true } },
        },
        orderBy: { name: 'asc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.hostel.count({ where }),
    ])

    return paginatedResponse(hostels, total, pagination)
  },
  { requireAuth: true, module: 'hostel' }
)

export const POST = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const body = await readJson(request)

    // Non-super-admins always write to their own school
    const schoolId = await resolveSchoolId(session, body.schoolId)
    if (!schoolId) {
      return errorResponse('School ID is required')
    }

    // The form sends blank optional inputs as '' and may send capacity as a string
    const { data, errors } = parseWith(hostelSchema, {
      ...body,
      schoolId,
      name: str(body.name) ?? '',
      code: str(body.code) ?? '',
      address: str(body.address),
      warden: str(body.warden),
      phone: str(body.phone),
      capacity: num(body.capacity),
    })

    if (errors) {
      return validationErrorResponse(errors)
    }

    // Hostel code is unique per school; name is kept unique as well
    const existingHostel = await prisma.hostel.findFirst({
      where: {
        schoolId,
        OR: [{ code: data.code }, { name: data.name }],
      },
    })

    if (existingHostel) {
      return existingHostel.code === data.code
        ? errorResponse('A hostel with this code already exists')
        : errorResponse('A hostel with this name already exists')
    }

    const hostel = await prisma.hostel.create({
      data: {
        schoolId,
        name: data.name,
        code: data.code,
        address: data.address,
        warden: data.warden,
        phone: data.phone,
        capacity: data.capacity,
        isActive: data.isActive,
      },
      include: {
        school: { select: { id: true, name: true } },
        _count: { select: { students: true, floors: true } },
      },
    })

    return successResponse(hostel, 201)
  },
  { requireAuth: true, module: 'hostel' }
)
