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
import { staffUpdateSchema } from '@/lib/validations'
import { logAudit } from '@/lib/audit'

export const GET = withApiHandler(
  async (_request: NextRequest, context, session: AuthenticatedSession | null) => {
    const { id } = await context.params
    const schoolFilter = getSchoolFilter(session)

    const staff = await prisma.staff.findFirst({
      where: {
        id,
        ...schoolFilter,
      },
      include: {
        school: { select: { id: true, name: true, code: true } },
        branch: { select: { id: true, name: true } },
        attendance: {
          orderBy: { date: 'desc' },
          take: 30,
        },
        leaveRequests: {
          orderBy: { startDate: 'desc' },
          take: 10,
        },
        payroll: {
          orderBy: [{ year: 'desc' }, { month: 'desc' }],
          take: 12,
        },
      },
    })

    if (!staff) {
      return notFoundResponse('Staff member not found')
    }

    // Only show sensitive data to admins
    if (session && hasMinimumRole(session.user.role, 'PRINCIPAL')) {
      return successResponse(staff)
    }

    // Remove sensitive fields for non-admins
    const { salary, bankDetails, ...sanitizedStaff } = staff
    return successResponse(sanitizedStaff)
  },
  { requireAuth: true, module: 'staff' }
)

export const PUT = withApiHandler(
  async (request: NextRequest, context, session: AuthenticatedSession | null) => {
    const { id } = await context.params
    const schoolFilter = getSchoolFilter(session)

    const existingStaff = await prisma.staff.findFirst({
      where: {
        id,
        ...schoolFilter,
      },
    })

    if (!existingStaff) {
      return notFoundResponse('Staff member not found')
    }

    const { data, errors } = await validateBody(request, staffUpdateSchema)

    if (errors) {
      return validationErrorResponse(errors)
    }

    if (!data) {
      return errorResponse('Invalid request body')
    }

    // Check if email is being changed and is unique
    if (data.email && data.email.toLowerCase() !== existingStaff.email.toLowerCase()) {
      const emailExists = await prisma.staff.findFirst({
        where: {
          email: data.email.toLowerCase(),
          id: { not: id },
        },
      })

      if (emailExists) {
        return validationErrorResponse({
          email: ['Email already exists'],
        })
      }
    }

    const updateData: Record<string, unknown> = {}
    if (data.firstName !== undefined) updateData.firstName = data.firstName
    if (data.lastName !== undefined) updateData.lastName = data.lastName
    if (data.email !== undefined) updateData.email = data.email.toLowerCase()
    if (data.phone !== undefined) updateData.phone = data.phone
    if (data.dateOfBirth) updateData.dateOfBirth = new Date(data.dateOfBirth)
    if (data.gender !== undefined) updateData.gender = data.gender
    if (data.bloodGroup !== undefined) updateData.bloodGroup = data.bloodGroup
    if (data.photo !== undefined) updateData.photo = data.photo
    if (data.address !== undefined) updateData.address = data.address
    if (data.city !== undefined) updateData.city = data.city
    if (data.state !== undefined) updateData.state = data.state
    if (data.pincode !== undefined) updateData.pincode = data.pincode
    if (data.branchId !== undefined) updateData.branchId = data.branchId || null
    if (data.staffType !== undefined) updateData.staffType = data.staffType
    if (data.designation !== undefined) updateData.designation = data.designation
    if (data.department !== undefined) updateData.department = data.department
    if (data.joiningDate) updateData.joiningDate = new Date(data.joiningDate)
    if (data.qualification !== undefined) updateData.qualification = data.qualification
    if (data.experience !== undefined) updateData.experience = data.experience
    if (data.salary !== undefined) updateData.salary = data.salary
    if (data.bankDetails !== undefined) updateData.bankDetails = data.bankDetails
    if (data.documents !== undefined) updateData.documents = data.documents
    if (data.isActive !== undefined) updateData.isActive = data.isActive

    const staff = await prisma.staff.update({
      where: { id },
      data: updateData,
      include: {
        school: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
    })

    await logAudit(session, request, 'UPDATE', 'Staff', id, { fields: Object.keys(updateData) })

    // Remove sensitive fields from response unless admin
    if (session && hasMinimumRole(session.user.role, 'PRINCIPAL')) {
      return successResponse(staff)
    }

    const { salary, bankDetails, ...sanitizedStaff } = staff
    return successResponse(sanitizedStaff)
  },
  { requireAuth: true, module: 'staff' }
)

export const DELETE = withApiHandler(
  async (request: NextRequest, context, session: AuthenticatedSession | null) => {
    const { id } = await context.params
    const schoolFilter = getSchoolFilter(session)

    // Only allow admins to delete staff
    if (!session || !hasMinimumRole(session.user.role, 'SCHOOL_ADMIN')) {
      return errorResponse('Only school admins can delete staff members', 403)
    }

    const existingStaff = await prisma.staff.findFirst({
      where: {
        id,
        ...schoolFilter,
      },
    })

    if (!existingStaff) {
      return notFoundResponse('Staff member not found')
    }

    // Soft delete - set isActive to false
    await prisma.staff.update({
      where: { id },
      data: { isActive: false },
    })

    await logAudit(session, request, 'DELETE', 'Staff', id, {
      employeeId: existingStaff.employeeId,
      deactivated: true,
    })

    return successResponse({ message: 'Staff member deactivated successfully' })
  },
  { requireAuth: true, module: 'staff' }
)
