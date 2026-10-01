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
import { announcementSchema } from '@/lib/validations'
import { Prisma } from '@prisma/client'

export const GET = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const pagination = getPaginationParams(request)
    // The announcements page renders the full list without paging controls
    if (!new URL(request.url).searchParams.has('limit')) {
      pagination.limit = 1000
      pagination.skip = (pagination.page - 1) * pagination.limit
    }
    const searchParams = getSearchParams(request)
    const schoolFilter = getSchoolFilter(session)

    const where: Prisma.AnnouncementWhereInput = {
      ...schoolFilter,
      ...(searchParams.search && {
        OR: [
          { title: { contains: searchParams.search, mode: 'insensitive' } },
          { content: { contains: searchParams.search, mode: 'insensitive' } },
        ],
      }),
      ...(searchParams.priority && { priority: searchParams.priority }),
      ...(searchParams.isActive !== undefined && { isActive: searchParams.isActive === 'true' }),
    }

    const [announcements, total] = await Promise.all([
      prisma.announcement.findMany({
        where,
        include: {
          school: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.announcement.count({ where }),
    ])

    return paginatedResponse(announcements, total, pagination)
  },
  { requireAuth: true, module: 'communication' }
)

export const POST = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const { data, errors } = await validateBody(request, announcementSchema)

    if (errors) {
      return validationErrorResponse(errors)
    }

    if (!data) {
      return errorResponse('Invalid request body')
    }

    // Non super-admins always publish to their own school
    const schoolId =
      session?.user.role === 'SUPER_ADMIN'
        ? data.schoolId || session?.user.schoolId
        : session?.user.schoolId || data.schoolId
    if (!schoolId) {
      return errorResponse('School ID is required')
    }

    const announcement = await prisma.announcement.create({
      data: {
        schoolId,
        title: data.title,
        content: data.content,
        targetRole: data.targetRole || undefined,
        targetClass: data.targetClass || undefined,
        priority: data.priority || 'NORMAL',
        attachments: data.attachments as Prisma.InputJsonValue | undefined,
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : new Date(),
        isActive: data.isActive,
      },
      include: {
        school: { select: { id: true, name: true } },
      },
    })

    return successResponse(announcement, 201)
  },
  { requireAuth: true, module: 'communication' }
)
