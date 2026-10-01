import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  getSchoolFilter,
  successResponse,
  notFoundResponse,
  validateBody,
  validationErrorResponse,
  errorResponse,
} from '@/lib/api-utils'
import { roleSchema } from '@/lib/validations'
import { logAudit } from '@/lib/audit'

// GET /api/roles/[id] - Get a specific role
export const GET = withApiHandler(
  async (request: NextRequest, { params }, session) => {
    const role = await prisma.role.findFirst({
      where: {
        id: params.id,
        ...getSchoolFilter(session),
      },
      include: {
        users: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
              },
            },
          },
        },
      },
    })

    if (!role) {
      return notFoundResponse('Role not found')
    }

    return successResponse(role)
  },
  { requireAuth: true, module: 'roles' }
)

// PUT /api/roles/[id] - Update a role
export const PUT = withApiHandler(
  async (request: NextRequest, { params }, session) => {
    const { data, errors } = await validateBody(request, roleSchema.partial())

    if (errors) {
      return validationErrorResponse(errors)
    }

    // Check if role exists and belongs to user's school
    const existingRole = await prisma.role.findFirst({
      where: {
        id: params.id,
        ...getSchoolFilter(session),
      },
    })

    if (!existingRole) {
      return notFoundResponse('Role not found')
    }

    if (data?.name && data.name !== existingRole.name) {
      const duplicate = await prisma.role.findFirst({
        where: { schoolId: existingRole.schoolId, name: data.name, id: { not: params.id } },
      })
      if (duplicate) {
        return validationErrorResponse({ name: ['A role with this name already exists'] })
      }
    }

    const role = await prisma.role.update({
      where: { id: params.id },
      data: {
        ...(data?.name && { name: data.name }),
        ...(data?.description !== undefined && { description: data.description }),
        ...(data?.permissions && { permissions: data.permissions }),
        ...(data?.isActive !== undefined && { isActive: data.isActive }),
      },
      include: {
        users: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
              },
            },
          },
        },
      },
    })

    await logAudit(session, request, 'UPDATE', 'Role', params.id, { name: data?.name, permissions: data?.permissions })

    return successResponse(role)
  },
  { requireAuth: true, module: 'roles' }
)

// DELETE /api/roles/[id] - Delete a role
export const DELETE = withApiHandler(
  async (request: NextRequest, { params }, session) => {
    // Check if role exists and belongs to user's school
    const role = await prisma.role.findFirst({
      where: {
        id: params.id,
        ...getSchoolFilter(session),
      },
    })

    if (!role) {
      return notFoundResponse('Role not found')
    }

    // Check if role is assigned to any users
    const usersWithRole = await prisma.userCustomRole.count({
      where: { roleId: params.id },
    })

    if (usersWithRole > 0) {
      return errorResponse('Cannot delete role that is assigned to users', 400)
    }

    await prisma.role.delete({
      where: { id: params.id },
    })

    await logAudit(session, request, 'DELETE', 'Role', params.id, { name: role.name })

    return successResponse({ message: 'Role deleted successfully' })
  },
  { requireAuth: true, module: 'roles' }
)
