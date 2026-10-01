import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  getSchoolFilter,
  successResponse,
  errorResponse,
  validationErrorResponse,
  validateBody
} from '@/lib/api-utils'
import { academicYearSchema } from '@/lib/validations'
import { resolveSchoolId } from '@/lib/school-scope'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'

// schoolId is taken from the session for school users; only SUPER_ADMIN may pass one
const academicYearCreateSchema = academicYearSchema.extend({
  schoolId: z.string().optional().nullable(),
})

export const GET = withApiHandler(
  async (request: NextRequest, { params }, session) => {
    const schoolFilter = getSchoolFilter(session)

    const years = await prisma.academicYear.findMany({
      where: schoolFilter,
      include: {
        school: { select: { id: true, name: true } },
        _count: { select: { classes: true } },
      },
      orderBy: { startDate: 'desc' }
    })

    return successResponse(years)
  },
  { requireAuth: true, module: 'academic-years' }
)

export const POST = withApiHandler(
  async (request: NextRequest, { params }, session) => {
    const { data, errors } = await validateBody(request, academicYearCreateSchema)
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

    if (!data.startDate || !data.endDate) {
      return validationErrorResponse({ startDate: ['Start and end dates are required'] })
    }
    const startDate = new Date(data.startDate)
    const endDate = new Date(data.endDate)
    if (endDate <= startDate) {
      return validationErrorResponse({ endDate: ['End date must be after start date'] })
    }

    const duplicate = await prisma.academicYear.findFirst({
      where: { schoolId, name: data.name },
    })
    if (duplicate) {
      return validationErrorResponse({ name: ['An academic year with this name already exists'] })
    }

    const year = await prisma.$transaction(async (tx) => {
      // Only one current year per school
      if (data.isCurrent) {
        await tx.academicYear.updateMany({
          where: { schoolId },
          data: { isCurrent: false }
        })
      }

      return tx.academicYear.create({
        data: {
          name: data.name,
          schoolId,
          startDate,
          endDate,
          isCurrent: data.isCurrent,
        },
        include: {
          school: { select: { id: true, name: true } },
        }
      })
    })

    await logAudit(session, request, 'CREATE', 'AcademicYear', year.id, { name: year.name })

    return successResponse(year, 201)
  },
  { requireAuth: true, module: 'academic-years' }
)
