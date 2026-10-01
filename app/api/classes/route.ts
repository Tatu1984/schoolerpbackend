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
  getSchoolFilter,
  AuthenticatedSession,
} from '@/lib/api-utils'
import { classSchema } from '@/lib/validations'
import { resolveSchoolId } from '@/lib/school-scope'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'

// schoolId is taken from the session for school users; only SUPER_ADMIN may pass one
const classCreateSchema = classSchema.extend({ schoolId: z.string().optional().nullable() })
import { Prisma } from '@prisma/client'

export const GET = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const pagination = getPaginationParams(request)
    const searchParams = getSearchParams(request)
    const schoolFilter = getSchoolFilter(session)

    const where: Prisma.ClassWhereInput = {
      ...schoolFilter,
      ...(searchParams.search && {
        OR: [
          { name: { contains: searchParams.search, mode: 'insensitive' } },
        ],
      }),
      ...(searchParams.grade && { grade: parseInt(searchParams.grade) }),
      ...(searchParams.academicYearId && { academicYearId: searchParams.academicYearId }),
      ...(searchParams.isActive !== undefined && { isActive: searchParams.isActive === 'true' }),
    }

    const [classes, total] = await Promise.all([
      prisma.class.findMany({
        where,
        include: {
          school: { select: { id: true, name: true } },
          academicYear: { select: { id: true, name: true, isCurrent: true } },
          sections: {
            select: {
              id: true,
              name: true,
              capacity: true,
              _count: { select: { students: true } },
            },
          },
          _count: {
            select: { students: true },
          },
        },
        orderBy: [{ grade: 'asc' }, { name: 'asc' }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.class.count({ where }),
    ])

    return paginatedResponse(classes, total, pagination)
  },
  { requireAuth: true, module: 'classes' }
)

export const POST = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const { data, errors } = await validateBody(request, classCreateSchema)

    if (errors) {
      return validationErrorResponse(errors)
    }

    if (!data) {
      return errorResponse('Invalid request body')
    }

    const schoolId = await resolveSchoolId(session, data.schoolId)
    if (!schoolId) {
      return errorResponse('School ID is required')
    }

    // Verify academic year belongs to school
    const academicYear = await prisma.academicYear.findFirst({
      where: {
        id: data.academicYearId,
        schoolId,
      },
    })

    if (!academicYear) {
      return validationErrorResponse({
        academicYearId: ['Invalid academic year for this school'],
      })
    }

    // Class name is unique per school + academic year
    const existingClass = await prisma.class.findFirst({
      where: {
        schoolId,
        academicYearId: data.academicYearId,
        name: data.name,
      },
    })

    if (existingClass) {
      return validationErrorResponse({
        name: ['Class with this name already exists for this academic year'],
      })
    }

    const newClass = await prisma.class.create({
      data: {
        ...data,
        branchId: data.branchId || null,
        schoolId,
      },
      include: {
        school: { select: { id: true, name: true } },
        academicYear: { select: { id: true, name: true } },
        sections: true,
      },
    })

    await logAudit(session, request, 'CREATE', 'Class', newClass.id, { name: newClass.name, grade: newClass.grade })

    return successResponse(newClass, 201)
  },
  { requireAuth: true, module: 'classes' }
)
