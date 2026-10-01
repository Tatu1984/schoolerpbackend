import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
  validateBody,
  getSchoolFilter,
  hasMinimumRole,
  AuthenticatedSession,
} from '@/lib/api-utils'
import { studentUpdateSchema } from '@/lib/validations'
import { Prisma } from '@prisma/client'

export const GET = withApiHandler(
  async (_request: NextRequest, context, session: AuthenticatedSession | null) => {
    const { id } = await context.params
    const schoolFilter = getSchoolFilter(session)

    const student = await prisma.student.findFirst({
      where: {
        id,
        ...schoolFilter,
      },
      include: {
        school: { select: { id: true, name: true, code: true } },
        branch: { select: { id: true, name: true } },
        class: {
          select: {
            id: true,
            name: true,
            grade: true,
            academicYear: { select: { id: true, name: true, isCurrent: true } },
          },
        },
        section: { select: { id: true, name: true } },
        guardians: true,
        siblings: {
          include: {
            sibling: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                admissionNumber: true,
                class: { select: { name: true } },
              },
            },
          },
        },
        fees: {
          include: {
            fee: { select: { id: true, name: true, type: true } },
          },
          orderBy: { dueDate: 'desc' },
          take: 10,
        },
        transport: {
          include: {
            route: { select: { id: true, name: true } },
            stop: { select: { id: true, name: true, arrivalTime: true, sequence: true } },
          },
        },
        hostel: {
          include: {
            hostel: { select: { id: true, name: true, code: true } },
            bed: {
              include: {
                room: { select: { id: true, number: true, type: true } },
              },
            },
          },
        },
      },
    })

    if (!student) {
      return notFoundResponse('Student not found')
    }

    return successResponse(student)
  },
  { requireAuth: true, module: 'students' }
)

export const PUT = withApiHandler(
  async (request: NextRequest, context, session: AuthenticatedSession | null) => {
    const { id } = await context.params
    const schoolFilter = getSchoolFilter(session)

    // Check if student exists and belongs to user's school
    const existingStudent = await prisma.student.findFirst({
      where: {
        id,
        ...schoolFilter,
      },
    })

    if (!existingStudent) {
      return notFoundResponse('Student not found')
    }

    const { data, errors } = await validateBody(request, studentUpdateSchema)

    if (errors) {
      return validationErrorResponse(errors)
    }

    if (!data) {
      return errorResponse('Invalid request body')
    }

    // If changing class, verify it belongs to the school
    if (data.classId && data.classId !== existingStudent.classId) {
      const classExists = await prisma.class.findFirst({
        where: {
          id: data.classId,
          schoolId: existingStudent.schoolId,
        },
      })

      if (!classExists) {
        return validationErrorResponse({
          classId: ['Invalid class for this school'],
        })
      }
    }

    const updateData: Record<string, unknown> = {}
    if (data.firstName !== undefined) updateData.firstName = data.firstName
    if (data.lastName !== undefined) updateData.lastName = data.lastName
    if (data.email !== undefined) updateData.email = data.email
    if (data.phone !== undefined) updateData.phone = data.phone
    if (data.dateOfBirth !== undefined) updateData.dateOfBirth = new Date(data.dateOfBirth)
    if (data.gender !== undefined) updateData.gender = data.gender
    if (data.bloodGroup !== undefined) updateData.bloodGroup = data.bloodGroup
    if (data.nationality !== undefined) updateData.nationality = data.nationality
    if (data.religion !== undefined) updateData.religion = data.religion
    if (data.address !== undefined) updateData.address = data.address
    if (data.branchId !== undefined) updateData.branchId = data.branchId
    if (data.classId !== undefined) updateData.classId = data.classId
    if (data.sectionId !== undefined) updateData.sectionId = data.sectionId
    if (data.rollNumber !== undefined) updateData.rollNumber = data.rollNumber
    if (data.admissionDate !== undefined) updateData.admissionDate = new Date(data.admissionDate)
    if (data.previousSchool !== undefined) updateData.previousSchool = data.previousSchool
    if (data.medicalInfo !== undefined) updateData.medicalInfo = data.medicalInfo as Prisma.InputJsonValue | undefined
    if (data.documents !== undefined) updateData.documents = data.documents as Prisma.InputJsonValue | undefined
    if (data.customFields !== undefined) updateData.customFields = data.customFields as Prisma.InputJsonValue | undefined
    if (data.photo !== undefined) updateData.photo = data.photo
    if (data.isActive !== undefined) updateData.isActive = data.isActive

    const student = await prisma.student.update({
      where: { id },
      data: updateData,
      include: {
        school: { select: { id: true, name: true } },
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
        guardians: true,
      },
    })

    return successResponse(student)
  },
  { requireAuth: true, module: 'students' }
)

export const DELETE = withApiHandler(
  async (_request: NextRequest, context, session: AuthenticatedSession | null) => {
    const { id } = await context.params
    const schoolFilter = getSchoolFilter(session)

    // Only allow admins to delete students
    if (!session || !hasMinimumRole(session.user.role, 'PRINCIPAL')) {
      return errorResponse('Only principals and admins can delete students', 403)
    }

    const existingStudent = await prisma.student.findFirst({
      where: {
        id,
        ...schoolFilter,
      },
    })

    if (!existingStudent) {
      return notFoundResponse('Student not found')
    }

    // Soft delete - set isActive to false instead of deleting
    await prisma.student.update({
      where: { id },
      data: { isActive: false },
    })

    return successResponse({ message: 'Student deactivated successfully' })
  },
  { requireAuth: true, module: 'students' }
)
