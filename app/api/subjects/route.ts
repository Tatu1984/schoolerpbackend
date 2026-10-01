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
  getSchoolFilter,
  AuthenticatedSession,
} from '@/lib/api-utils'
import { subjectSchema } from '@/lib/validations'
import { resolveSchoolId } from '@/lib/school-scope'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'

// schoolId is taken from the session for school users; only SUPER_ADMIN may pass one
const subjectCreateSchema = subjectSchema.extend({ schoolId: z.string().optional().nullable() })
import { Prisma } from '@prisma/client'

export const GET = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const pagination = getPaginationParams(request)
    const searchParams = getSearchParams(request)
    const schoolFilter = getSchoolFilter(session)

    const where: Prisma.SubjectWhereInput = {
      ...schoolFilter,
      ...(searchParams.search && {
        OR: [
          { name: { contains: searchParams.search, mode: 'insensitive' } },
          { code: { contains: searchParams.search, mode: 'insensitive' } },
        ],
      }),
      ...(searchParams.classId && { classId: searchParams.classId }),
      ...(searchParams.isActive !== undefined && { isActive: searchParams.isActive === 'true' }),
    }

    const [subjects, total] = await Promise.all([
      prisma.subject.findMany({
        where,
        include: {
          school: { select: { id: true, name: true } },
          class: { select: { id: true, name: true, grade: true } },
        },
        orderBy: { name: 'asc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.subject.count({ where }),
    ])

    return paginatedResponse(subjects, total, pagination)
  },
  { requireAuth: true, module: 'subjects' }
)

export const POST = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const { data, errors } = await validateBody(request, subjectCreateSchema)

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

    const classId = data.classId || null

    // Verify class belongs to school if provided
    if (classId) {
      const classExists = await prisma.class.findFirst({
        where: {
          id: classId,
          schoolId,
        },
      })

      if (!classExists) {
        return validationErrorResponse({
          classId: ['Invalid class for this school'],
        })
      }
    }

    // Check for duplicate subject code in school
    const existingSubject = await prisma.subject.findFirst({
      where: {
        schoolId,
        code: data.code,
      },
    })

    if (existingSubject) {
      return validationErrorResponse({
        code: ['Subject code already exists in this school'],
      })
    }

    const subject = await prisma.subject.create({
      data: {
        ...data,
        classId,
        schoolId,
      },
      include: {
        school: { select: { id: true, name: true } },
        class: { select: { id: true, name: true } },
      },
    })

    await logAudit(session, request, 'CREATE', 'Subject', subject.id, { name: subject.name, code: subject.code })

    return successResponse(subject, 201)
  },
  { requireAuth: true, module: 'subjects' }
)
