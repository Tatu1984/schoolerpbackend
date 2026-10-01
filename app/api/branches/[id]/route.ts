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
import { branchSchema } from '@/lib/validations'
import { logAudit } from '@/lib/audit'

export const GET = withApiHandler(
  async (_request: NextRequest, { params }, session) => {
    const branch = await prisma.branch.findFirst({
      where: { id: params.id, ...getSchoolFilter(session) },
      include: { school: { select: { id: true, name: true } } },
    })

    if (!branch) {
      return notFoundResponse('Branch not found')
    }

    return successResponse(branch)
  },
  { requireAuth: true, module: 'branches' }
)

export const PUT = withApiHandler(
  async (request: NextRequest, { params }, session) => {
    const schoolFilter = getSchoolFilter(session)

    // Check if branch exists and user has access
    const existingBranch = await prisma.branch.findFirst({
      where: {
        id: params.id,
        ...schoolFilter
      }
    })

    if (!existingBranch) {
      return notFoundResponse('Branch not found')
    }

    // The form re-sends schoolId on edit; it is ignored (a branch cannot move schools)
    const { data, errors } = await validateBody(request, branchSchema.partial())
    if (errors) {
      return validationErrorResponse(errors)
    }
    if (!data) {
      return errorResponse('Invalid request body')
    }

    if (data.code && data.code !== existingBranch.code) {
      const duplicate = await prisma.branch.findFirst({
        where: { schoolId: existingBranch.schoolId, code: data.code, id: { not: params.id } },
      })
      if (duplicate) {
        return validationErrorResponse({ code: ['Branch code already exists in this school'] })
      }
    }

    const branch = await prisma.branch.update({
      where: { id: params.id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.code !== undefined && { code: data.code }),
        ...(data.address !== undefined && { address: data.address || null }),
        ...(data.city !== undefined && { city: data.city || null }),
        ...(data.state !== undefined && { state: data.state || null }),
        ...(data.phone !== undefined && { phone: data.phone || null }),
        ...(data.email !== undefined && { email: data.email ? data.email.toLowerCase() : null }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      include: {
        school: { select: { id: true, name: true } },
      }
    })

    await logAudit(session, request, 'UPDATE', 'Branch', params.id, { ...data, schoolId: undefined })

    return successResponse(branch)
  },
  { requireAuth: true, module: 'branches' }
)

export const DELETE = withApiHandler(
  async (request: NextRequest, { params }, session) => {
    const schoolFilter = getSchoolFilter(session)

    // Check if branch exists and user has access
    const existingBranch = await prisma.branch.findFirst({
      where: {
        id: params.id,
        ...schoolFilter
      },
      include: {
        _count: { select: { classes: true, students: true, staff: true } },
      },
    })

    if (!existingBranch) {
      return notFoundResponse('Branch not found')
    }

    // Classes, students and staff reference the branch without cascade
    const { classes, students, staff } = existingBranch._count
    if (classes > 0 || students > 0 || staff > 0) {
      return errorResponse(
        'Cannot delete a branch that still has classes, students or staff assigned to it.',
        400
      )
    }

    await prisma.branch.delete({
      where: { id: params.id }
    })

    await logAudit(session, request, 'DELETE', 'Branch', params.id, { name: existingBranch.name })

    return successResponse({ message: 'Branch deleted successfully' })
  },
  { requireAuth: true, module: 'branches' }
)
