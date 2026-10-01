import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import {
  withApiHandler,
  successResponse,
  notFoundResponse,
  errorResponse,
  validationErrorResponse,
  validateBody,
  getSchoolFilter,
  hasMinimumRole,
  AuthenticatedSession,
} from '@/lib/api-utils'
import { admissionSchema } from '@/lib/validations'

const admissionUpdateSchema = admissionSchema.partial().omit({ schoolId: true, inquiryNumber: true })

export const GET = withApiHandler(
  async (_request: NextRequest, context, session: AuthenticatedSession | null) => {
    const { id } = await context.params
    const schoolFilter = getSchoolFilter(session)

    const admission = await prisma.admission.findFirst({
      where: {
        id,
        ...schoolFilter,
      },
      include: {
        school: { select: { id: true, name: true } },
        academicYear: { select: { id: true, name: true } },
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
            class: { select: { id: true, name: true } },
          },
        },
      },
    })

    if (!admission) {
      return notFoundResponse('Admission not found')
    }

    return successResponse(admission)
  },
  { requireAuth: true, module: 'admissions' }
)

export const PUT = withApiHandler(
  async (request: NextRequest, context, session: AuthenticatedSession | null) => {
    const { id } = await context.params
    const schoolFilter = getSchoolFilter(session)

    const existingAdmission = await prisma.admission.findFirst({
      where: {
        id,
        ...schoolFilter,
      },
    })

    if (!existingAdmission) {
      return notFoundResponse('Admission not found')
    }

    const { data, errors } = await validateBody(request, admissionUpdateSchema)

    if (errors) {
      return validationErrorResponse(errors)
    }

    if (!data) {
      return errorResponse('Invalid request body')
    }

    // Extract documents and handle null specifically for Prisma JSON fields
    const { documents, ...restData } = data

    const updateData: Prisma.AdmissionUpdateInput = {
      ...restData,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
      testDate: data.testDate ? new Date(data.testDate) : undefined,
      interviewDate: data.interviewDate ? new Date(data.interviewDate) : undefined,
    }

    // Handle documents field - Prisma requires special handling for nullable JSON
    if (documents !== undefined) {
      updateData.documents = documents === null
        ? Prisma.JsonNull
        : (documents as Prisma.InputJsonValue)
    }

    const admission = await prisma.admission.update({
      where: { id },
      data: updateData,
      include: {
        school: { select: { id: true, name: true } },
        academicYear: { select: { id: true, name: true } },
      },
    })

    return successResponse(admission)
  },
  { requireAuth: true, module: 'admissions' }
)

export const DELETE = withApiHandler(
  async (_request: NextRequest, context, session: AuthenticatedSession | null) => {
    const { id } = await context.params
    const schoolFilter = getSchoolFilter(session)

    // Only admins can delete admissions
    if (!session || !hasMinimumRole(session.user.role, 'SCHOOL_ADMIN')) {
      return errorResponse('Only administrators can delete admissions', 403)
    }

    const existingAdmission = await prisma.admission.findFirst({
      where: {
        id,
        ...schoolFilter,
      },
    })

    if (!existingAdmission) {
      return notFoundResponse('Admission not found')
    }

    await prisma.admission.delete({
      where: { id },
    })

    return successResponse({ message: 'Admission deleted successfully' })
  },
  { requireAuth: true, module: 'admissions' }
)
