import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  getSchoolFilter,
  successResponse,
  errorResponse,
  validationErrorResponse,
  validateBody,
  notFoundResponse
} from '@/lib/api-utils'
import { academicYearSchema } from '@/lib/validations'
import { logAudit } from '@/lib/audit'

export const GET = withApiHandler(
  async (_request: NextRequest, { params }, session) => {
    const year = await prisma.academicYear.findFirst({
      where: { id: params.id, ...getSchoolFilter(session) },
      include: { school: { select: { id: true, name: true } } },
    })

    if (!year) {
      return notFoundResponse('Academic year not found')
    }

    return successResponse(year)
  },
  { requireAuth: true, module: 'academic-years' }
)

export const PUT = withApiHandler(
  async (request: NextRequest, { params }, session) => {
    const schoolFilter = getSchoolFilter(session)

    // Check if academic year exists and user has access
    const existingYear = await prisma.academicYear.findFirst({
      where: {
        id: params.id,
        ...schoolFilter
      }
    })

    if (!existingYear) {
      return notFoundResponse('Academic year not found')
    }

    // The form re-sends schoolId on edit; it is ignored (a year cannot move schools)
    const { data, errors } = await validateBody(request, academicYearSchema.partial())
    if (errors) {
      return validationErrorResponse(errors)
    }
    if (!data) {
      return errorResponse('Invalid request body')
    }

    const startDate = data.startDate ? new Date(data.startDate) : existingYear.startDate
    const endDate = data.endDate ? new Date(data.endDate) : existingYear.endDate
    if (endDate <= startDate) {
      return validationErrorResponse({ endDate: ['End date must be after start date'] })
    }

    if (data.name && data.name !== existingYear.name) {
      const duplicate = await prisma.academicYear.findFirst({
        where: { schoolId: existingYear.schoolId, name: data.name, id: { not: params.id } },
      })
      if (duplicate) {
        return validationErrorResponse({ name: ['An academic year with this name already exists'] })
      }
    }

    const updatedYear = await prisma.$transaction(async (tx) => {
      // Only one current year per school
      if (data.isCurrent) {
        await tx.academicYear.updateMany({
          where: { schoolId: existingYear.schoolId, id: { not: params.id } },
          data: { isCurrent: false }
        })
      }

      return tx.academicYear.update({
        where: { id: params.id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          startDate,
          endDate,
          ...(data.isCurrent !== undefined && { isCurrent: data.isCurrent }),
        },
        include: {
          school: { select: { id: true, name: true } },
        }
      })
    })

    await logAudit(session, request, 'UPDATE', 'AcademicYear', params.id, {
      name: data.name,
      startDate: data.startDate,
      endDate: data.endDate,
      isCurrent: data.isCurrent,
    })

    return successResponse(updatedYear)
  },
  { requireAuth: true, module: 'academic-years' }
)

export const DELETE = withApiHandler(
  async (request: NextRequest, { params }, session) => {
    const schoolFilter = getSchoolFilter(session)

    // Check if academic year exists and user has access
    const existingYear = await prisma.academicYear.findFirst({
      where: {
        id: params.id,
        ...schoolFilter
      },
      include: {
        _count: { select: { classes: true, admissions: true, reportCards: true } },
      },
    })

    if (!existingYear) {
      return notFoundResponse('Academic year not found')
    }

    // Classes, admissions and report cards reference the year without cascade
    const { classes, admissions, reportCards } = existingYear._count
    if (classes > 0 || admissions > 0 || reportCards > 0) {
      return errorResponse(
        'Cannot delete an academic year that has classes, admissions or report cards linked to it.',
        400
      )
    }

    await prisma.academicYear.delete({
      where: { id: params.id }
    })

    await logAudit(session, request, 'DELETE', 'AcademicYear', params.id, { name: existingYear.name })

    return successResponse({ message: 'Academic year deleted successfully' })
  },
  { requireAuth: true, module: 'academic-years' }
)
