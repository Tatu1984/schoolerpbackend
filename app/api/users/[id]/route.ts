import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { hash } from 'bcryptjs'
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
import { userUpdateSchema } from '@/lib/validations'
import { z } from 'zod'
import { UserRole } from '@prisma/client'

const updateSchema = userUpdateSchema.extend({
  password: z.string().min(8).max(100).optional(),
  customRoleIds: z.array(z.string()).optional(),
})

export const GET = withApiHandler(
  async (_request: NextRequest, context, session: AuthenticatedSession | null) => {
    const { id } = await context.params
    const schoolFilter = getSchoolFilter(session)

    // Users can view their own profile, admins can view anyone in their school
    if (session?.user.id !== id && !hasMinimumRole(session?.user.role || 'STUDENT', 'SCHOOL_ADMIN')) {
      return errorResponse('Access denied', 403)
    }

    const user = await prisma.user.findFirst({
      where: {
        id,
        ...(session?.user.id !== id ? schoolFilter : {}),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        school: { select: { id: true, name: true } },
        customRoles: {
          include: {
            role: { select: { id: true, name: true, permissions: true } },
          },
        },
      },
    })

    if (!user) {
      return notFoundResponse('User not found')
    }

    return successResponse(user)
  },
  { requireAuth: true }
)

export const PUT = withApiHandler(
  async (request: NextRequest, context, session: AuthenticatedSession | null) => {
    const { id } = await context.params
    const schoolFilter = getSchoolFilter(session)

    // Users can update their own profile (limited fields), admins can update anyone
    const isOwnProfile = session?.user.id === id
    const isAdmin = hasMinimumRole(session?.user.role || 'STUDENT', 'SCHOOL_ADMIN')

    if (!isOwnProfile && !isAdmin) {
      return errorResponse('Access denied', 403)
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        id,
        ...(isOwnProfile ? {} : schoolFilter),
      },
    })

    if (!existingUser) {
      return notFoundResponse('User not found')
    }

    const { data, errors } = await validateBody(request, updateSchema)

    if (errors) {
      return validationErrorResponse(errors)
    }

    if (!data) {
      return errorResponse('Invalid request body')
    }

    // Regular users can only update limited fields
    if (isOwnProfile && !isAdmin) {
      const allowedFields = ['name', 'password']
      const attemptedFields = Object.keys(data)
      const disallowedFields = attemptedFields.filter((f) => !allowedFields.includes(f))
      if (disallowedFields.length > 0) {
        return errorResponse(`Cannot update fields: ${disallowedFields.join(', ')}`, 403)
      }
    }

    // Prevent role escalation
    if (data.role && session) {
      const roleHierarchy: Record<UserRole, number> = {
        SUPER_ADMIN: 100,
        SCHOOL_ADMIN: 90,
        PRINCIPAL: 80,
        VICE_PRINCIPAL: 70,
        HEAD_TEACHER: 60,
        TEACHER: 50,
        ACCOUNTANT: 50,
        LIBRARIAN: 40,
        TRANSPORT_MANAGER: 40,
        HOSTEL_WARDEN: 40,
        RECEPTIONIST: 30,
        PARENT: 20,
        STUDENT: 10,
      }

      if (roleHierarchy[data.role] >= roleHierarchy[session.user.role]) {
        return errorResponse('Cannot assign equal or higher privileges', 403)
      }
    }

    // Check email uniqueness
    if (data.email && data.email.toLowerCase() !== existingUser.email.toLowerCase()) {
      const emailExists = await prisma.user.findFirst({
        where: { email: data.email.toLowerCase(), id: { not: id } },
      })
      if (emailExists) {
        return validationErrorResponse({ email: ['Email already exists'] })
      }
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {}

    if (data.email) updateData.email = data.email.toLowerCase()
    if (data.firstName) updateData.firstName = data.firstName
    if (data.lastName) updateData.lastName = data.lastName
    if (data.phone !== undefined) updateData.phone = data.phone
    if (data.role) updateData.role = data.role
    if (data.isActive !== undefined) updateData.isActive = data.isActive
    if (data.password) updateData.password = await hash(data.password, 12)

    // Handle custom roles
    if (data.customRoleIds !== undefined && isAdmin) {
      await prisma.userCustomRole.deleteMany({
        where: { userId: id },
      })

      if (data.customRoleIds.length > 0) {
        await prisma.userCustomRole.createMany({
          data: data.customRoleIds.map((roleId: string) => ({
            userId: id,
            roleId,
          })),
        })
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        school: { select: { id: true, name: true } },
        customRoles: {
          include: {
            role: { select: { id: true, name: true } },
          },
        },
      },
    })

    return successResponse(user)
  },
  { requireAuth: true }
)

export const DELETE = withApiHandler(
  async (_request: NextRequest, context, session: AuthenticatedSession | null) => {
    const { id } = await context.params
    const schoolFilter = getSchoolFilter(session)

    // Only admins can delete users
    if (!session || !hasMinimumRole(session.user.role, 'SCHOOL_ADMIN')) {
      return errorResponse('Only administrators can delete users', 403)
    }

    // Cannot delete yourself
    if (session.user.id === id) {
      return errorResponse('Cannot delete your own account', 400)
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        id,
        ...schoolFilter,
      },
    })

    if (!existingUser) {
      return notFoundResponse('User not found')
    }

    // Soft delete - set isActive to false
    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    })

    return successResponse({ message: 'User deactivated successfully' })
  },
  { requireAuth: true }
)
