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
  getSortParams,
  getSchoolFilter,
  AuthenticatedSession,
} from '@/lib/api-utils'
import { feeSchema } from '@/lib/validations'
import { resolveSchoolId } from '@/lib/school-scope'
import { readJson, parseWith, str, num } from '@/lib/form-body'
import { Prisma } from '@prisma/client'

export const GET = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const pagination = getPaginationParams(request)
    const searchParams = getSearchParams(request)
    const orderBy = getSortParams(request, ['createdAt', 'name', 'amount', 'type'])
    const schoolFilter = getSchoolFilter(session)

    const where: Prisma.FeeWhereInput = {
      ...schoolFilter,
      ...(searchParams.search && {
        OR: [
          { name: { contains: searchParams.search, mode: 'insensitive' } },
          { description: { contains: searchParams.search, mode: 'insensitive' } },
        ],
      }),
      ...(searchParams.type && { type: searchParams.type as Prisma.EnumFeeTypeFilter }),
      ...(searchParams.frequency && { frequency: searchParams.frequency as Prisma.EnumFeeFrequencyFilter }),
      ...(searchParams.classId && { classId: searchParams.classId }),
      ...(searchParams.isActive !== undefined && { isActive: searchParams.isActive === 'true' }),
    }

    const [fees, total] = await Promise.all([
      prisma.fee.findMany({
        where,
        include: {
          school: { select: { id: true, name: true } },
          class: { select: { id: true, name: true, grade: true } },
          _count: {
            select: { payments: true },
          },
        },
        orderBy,
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.fee.count({ where }),
    ])

    return paginatedResponse(fees, total, pagination)
  },
  { requireAuth: true, module: 'fees' }
)

export const POST = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const body = await readJson(request)

    // The form may send an empty schoolId; non-super-admins always use their own school
    const schoolId = await resolveSchoolId(session, body.schoolId)
    if (!schoolId) {
      return errorResponse('School ID is required')
    }

    const { data, errors } = parseWith(feeSchema, {
      ...body,
      schoolId,
      name: str(body.name) ?? '',
      classId: str(body.classId),
      description: str(body.description),
      amount: num(body.amount),
    })

    if (errors) {
      return validationErrorResponse(errors)
    }

    // Verify class belongs to school if provided
    if (data.classId) {
      const classExists = await prisma.class.findFirst({
        where: {
          id: data.classId,
          schoolId,
        },
      })

      if (!classExists) {
        return validationErrorResponse({
          classId: ['Invalid class for this school'],
        })
      }
    }

    const fee = await prisma.fee.create({
      data: {
        schoolId,
        name: data.name,
        type: data.type,
        amount: data.amount,
        frequency: data.frequency,
        classId: data.classId,
        description: data.description,
        isActive: data.isActive,
      },
      include: {
        school: { select: { id: true, name: true } },
        class: { select: { id: true, name: true } },
      },
    })

    return successResponse(fee, 201)
  },
  { requireAuth: true, module: 'fees' }
)
