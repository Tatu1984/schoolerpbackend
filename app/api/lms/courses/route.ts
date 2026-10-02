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
import { Prisma } from '@prisma/client'
import {
  courseInclude,
  courseToClient,
  resolveInstructor,
  instructorNotFoundMessage,
  parseOptionalDate,
  isUniqueViolation,
} from './helpers'

export const GET = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const pagination = getPaginationParams(request)
    const searchParams = getSearchParams(request)
    const schoolFilter = getSchoolFilter(session)

    // The course list feeds dropdowns and a full grid on the dashboard, neither
    // of which pages. Only apply the default page size when a caller asks for one.
    const explicitLimit = new URL(request.url).searchParams.has('limit')
    if (!explicitLimit) {
      pagination.limit = 1000
      pagination.skip = (pagination.page - 1) * pagination.limit
    }

    const where: Prisma.CourseWhereInput = {
      ...schoolFilter,
      ...(searchParams.search && {
        OR: [
          { name: { contains: searchParams.search, mode: 'insensitive' } },
          { description: { contains: searchParams.search, mode: 'insensitive' } },
        ],
      }),
      ...(searchParams.classId && { classId: searchParams.classId }),
      ...(searchParams.teacherId && { teacherId: searchParams.teacherId }),
      ...(searchParams.isActive !== undefined && { isActive: searchParams.isActive === 'true' }),
    }

    const [courses, total] = await Promise.all([
      prisma.course.findMany({
        where,
        include: courseInclude,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.course.count({ where }),
    ])

    return paginatedResponse(courses.map(courseToClient), total, pagination)
  },
  { requireAuth: true, module: 'lms' }
)

export const POST = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return errorResponse('Invalid request body')
    }

    // Non super-admins can only create courses in their own school
    const schoolId =
      session?.user.role === 'SUPER_ADMIN'
        ? body.schoolId || session?.user.schoolId
        : session?.user.schoolId || body.schoolId
    if (!schoolId) {
      return errorResponse('School ID is required')
    }

    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const code = typeof body.code === 'string' ? body.code.trim() : ''
    const startDate = parseOptionalDate(body.startDate)
    const endDate = parseOptionalDate(body.endDate)

    const errors: Record<string, string[]> = {}
    if (!name) errors.name = ['Course name is required']
    if (!code) errors.code = ['Course code is required']
    if (startDate === 'invalid') errors.startDate = ['Invalid date']
    if (endDate === 'invalid') errors.endDate = ['Invalid date']
    if (Object.keys(errors).length) {
      return validationErrorResponse(errors)
    }

    const classId: string | null = body.classId || null
    if (classId) {
      const classExists = await prisma.class.findFirst({ where: { id: classId, schoolId } })
      if (!classExists) {
        return validationErrorResponse({ classId: ['Invalid class for this school'] })
      }
    }

    const subjectId: string | null = body.subjectId || null
    if (subjectId) {
      const subject = await prisma.subject.findFirst({ where: { id: subjectId, schoolId } })
      if (!subject) {
        return validationErrorResponse({ subjectId: ['Invalid subject for this school'] })
      }
    }

    let teacherId: string | null = body.teacherId || null
    if (teacherId) {
      const teacher = await prisma.staff.findFirst({ where: { id: teacherId, schoolId } })
      if (!teacher) {
        return validationErrorResponse({ teacherId: ['Invalid teacher for this school'] })
      }
    } else if (typeof body.instructor === 'string' && body.instructor.trim()) {
      const resolved = await resolveInstructor(body.instructor, schoolId)
      if (resolved === undefined) {
        // There is no free-text column: saving would silently drop the name
        return validationErrorResponse({ instructor: [instructorNotFoundMessage(body.instructor)] })
      }
      teacherId = resolved
    }

    try {
      const course = await prisma.course.create({
        data: {
          schoolId,
          name,
          code,
          description: body.description || null,
          classId,
          subjectId,
          teacherId,
          startDate: startDate as Date | null,
          endDate: endDate as Date | null,
          isActive: typeof body.isActive === 'boolean' ? body.isActive : true,
        },
        include: courseInclude,
      })

      return successResponse(courseToClient(course), 201)
    } catch (error) {
      if (isUniqueViolation(error)) {
        return errorResponse(`A course with code "${code}" already exists in this school`, 409)
      }
      throw error
    }
  },
  { requireAuth: true, module: 'lms' }
)
