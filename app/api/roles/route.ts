import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  getSchoolFilter,
  getPaginationParams,
  successResponse,
  validateBody,
  validationErrorResponse,
} from '@/lib/api-utils'
import { roleSchema } from '@/lib/validations'
import { resolveSchoolId } from '@/lib/school-scope'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'

// schoolId is taken from the session for school users; only SUPER_ADMIN may pass one
const roleCreateSchema = roleSchema.extend({ schoolId: z.string().optional().nullable() })

// GET /api/roles - Get all roles
export const GET = withApiHandler(
  async (request: NextRequest, context, session) => {
    const roles = await prisma.role.findMany({
      where: getSchoolFilter(session),
      include: {
        users: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return successResponse(roles)
  },
  { requireAuth: true, module: 'roles' }
)

// POST /api/roles - Create a new role
export const POST = withApiHandler(
  async (request: NextRequest, context, session) => {
    const { data, errors } = await validateBody(request, roleCreateSchema)

    if (errors) {
      return validationErrorResponse(errors)
    }

    // Ensure schoolId is set from session if not provided
    const schoolId = await resolveSchoolId(session, data!.schoolId)

    if (!schoolId) {
      return validationErrorResponse({
        schoolId: ['School ID is required'],
      })
    }

    const duplicate = await prisma.role.findFirst({
      where: { schoolId, name: data!.name },
    })
    if (duplicate) {
      return validationErrorResponse({ name: ['A role with this name already exists'] })
    }

    const role = await prisma.role.create({
      data: {
        name: data!.name,
        description: data!.description || null,
        permissions: data!.permissions,
        isActive: data!.isActive,
        schoolId,
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
              },
            },
          },
        },
      },
    })

    await logAudit(session, request, 'CREATE', 'Role', role.id, { name: role.name })

    return successResponse(role, 201)
  },
  { requireAuth: true, module: 'roles' }
)
