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
import { branchSchema } from '@/lib/validations'
import { resolveSchoolId } from '@/lib/school-scope'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'

// schoolId is taken from the session for school users; only SUPER_ADMIN may pass one
const branchCreateSchema = branchSchema.extend({ schoolId: z.string().optional().nullable() })

export const GET = withApiHandler(
  async (request: NextRequest, { params }, session) => {
    const schoolFilter = getSchoolFilter(session)

    const branches = await prisma.branch.findMany({
      where: schoolFilter,
      include: {
        school: { select: { id: true, name: true } },
        _count: { select: { classes: true, students: true, staff: true } },
      },
      orderBy: { createdAt: 'desc' }
    })

    return successResponse(branches)
  },
  { requireAuth: true, module: 'branches' }
)

export const POST = withApiHandler(
  async (request: NextRequest, { params }, session) => {
    const { data, errors } = await validateBody(request, branchCreateSchema)
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

    const duplicate = await prisma.branch.findFirst({
      where: { schoolId, code: data.code },
    })
    if (duplicate) {
      return validationErrorResponse({ code: ['Branch code already exists in this school'] })
    }

    const branch = await prisma.branch.create({
      data: {
        schoolId,
        name: data.name,
        code: data.code,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        phone: data.phone || null,
        email: data.email ? data.email.toLowerCase() : null,
        isActive: data.isActive,
      },
      include: {
        school: { select: { id: true, name: true } },
      }
    })

    await logAudit(session, request, 'CREATE', 'Branch', branch.id, { name: branch.name, code: branch.code })

    return successResponse(branch, 201)
  },
  { requireAuth: true, module: 'branches' }
)
