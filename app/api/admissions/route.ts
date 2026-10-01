import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  successResponse,
  errorResponse,
  validationErrorResponse,
  paginatedResponse,
  getSearchParams,
  getSortParams,
  getSchoolFilter,
  AuthenticatedSession,
} from '@/lib/api-utils'
import { AdmissionStatus, Prisma } from '@prisma/client'
import { ADMISSION_STATUSES, createAdmission, getListParams } from './helpers'

export const GET = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const pagination = getListParams(request)
    const searchParams = getSearchParams(request)
    const orderBy = getSortParams(request, ['createdAt', 'firstName', 'lastName', 'status'])
    const schoolFilter = getSchoolFilter(session)

    const where: Prisma.AdmissionWhereInput = {
      ...schoolFilter,
      ...(searchParams.search && {
        OR: [
          { firstName: { contains: searchParams.search, mode: 'insensitive' } },
          { lastName: { contains: searchParams.search, mode: 'insensitive' } },
          { inquiryNumber: { contains: searchParams.search, mode: 'insensitive' } },
          { parentName: { contains: searchParams.search, mode: 'insensitive' } },
          { parentEmail: { contains: searchParams.search, mode: 'insensitive' } },
        ],
      }),
      ...(searchParams.status && ADMISSION_STATUSES.includes(searchParams.status) && {
        status: searchParams.status as AdmissionStatus,
      }),
      ...(searchParams.appliedClass && { appliedClass: searchParams.appliedClass }),
    }

    const [admissions, total] = await Promise.all([
      prisma.admission.findMany({
        where,
        include: {
          school: { select: { id: true, name: true } },
          academicYear: { select: { id: true, name: true } },
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              admissionNumber: true,
            },
          },
        },
        orderBy,
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.admission.count({ where }),
    ])

    return paginatedResponse(admissions, total, pagination)
  },
  { requireAuth: true, module: 'admissions' }
)

export const POST = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return errorResponse('Invalid request body')
    }

    const status = ADMISSION_STATUSES.includes(body.status) ? (body.status as AdmissionStatus) : 'INQUIRY'

    const result = await createAdmission(session, body, { status })
    if (result.errors) {
      return validationErrorResponse(result.errors)
    }

    const admission = await prisma.admission.findUnique({
      where: { id: result.admission.id },
      include: {
        school: { select: { id: true, name: true } },
        academicYear: { select: { id: true, name: true } },
      },
    })

    return successResponse(admission, 201)
  },
  { requireAuth: true, module: 'admissions' }
)
