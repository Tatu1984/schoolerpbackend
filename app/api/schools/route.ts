import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  successResponse,
  errorResponse,
  validationErrorResponse,
  validateBody,
  getPaginationParams,
  paginatedResponse,
  getSearchParams,
  getSortParams,
  hasRole,
  AuthenticatedSession,
} from '@/lib/api-utils'
import { schoolSchema } from '@/lib/validations'
import { Prisma } from '@prisma/client'

export const GET = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    // Only super admins can see all schools
    // Other users can only see their own school
    if (session?.user.role !== 'SUPER_ADMIN') {
      if (!session?.user.schoolId) {
        return successResponse([])
      }

      const school = await prisma.school.findUnique({
        where: { id: session.user.schoolId },
        include: {
          branches: { select: { id: true, name: true, isActive: true } },
          _count: {
            select: {
              users: true,
              students: true,
              staff: true,
            },
          },
        },
      })

      return successResponse(school ? [school] : [])
    }

    const pagination = getPaginationParams(request)
    const searchParams = getSearchParams(request)
    const orderBy = getSortParams(request, ['createdAt', 'name', 'code'])

    const where: Prisma.SchoolWhereInput = {
      ...(searchParams.search && {
        OR: [
          { name: { contains: searchParams.search, mode: 'insensitive' } },
          { code: { contains: searchParams.search, mode: 'insensitive' } },
        ],
      }),
      ...(searchParams.isActive !== undefined && { isActive: searchParams.isActive === 'true' }),
    }

    const [schools, total] = await Promise.all([
      prisma.school.findMany({
        where,
        include: {
          branches: { select: { id: true, name: true, isActive: true } },
          _count: {
            select: {
              users: true,
              students: true,
              staff: true,
              classes: true,
            },
          },
        },
        orderBy,
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.school.count({ where }),
    ])

    return paginatedResponse(schools, total, pagination)
  },
  { requireAuth: true, module: 'schools' }
)

export const POST = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    // Only super admins can create schools
    if (!session || !hasRole(session.user.role, ['SUPER_ADMIN'])) {
      return errorResponse('Only super admins can create schools', 403)
    }

    const { data, errors } = await validateBody(request, schoolSchema)

    if (errors) {
      return validationErrorResponse(errors)
    }

    if (!data) {
      return errorResponse('Invalid request body')
    }

    // Check for unique school code
    const existingSchool = await prisma.school.findFirst({
      where: {
        OR: [
          { code: data.code },
          { name: data.name },
        ],
      },
    })

    if (existingSchool) {
      if (existingSchool.code === data.code) {
        return validationErrorResponse({
          code: ['School code already exists'],
        })
      }
      return validationErrorResponse({
        name: ['School name already exists'],
      })
    }

    const school = await prisma.school.create({
      data: {
        ...data,
        email: data.email?.toLowerCase(),
        established: data.established ? new Date(data.established) : null,
      },
      include: {
        branches: true,
      },
    })

    return successResponse(school, 201)
  },
  { requireAuth: true, module: 'schools' }
)
