import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  getSchoolFilter,
  successResponse,
  errorResponse,
  validationErrorResponse,
  notFoundResponse,
} from '@/lib/api-utils'
import { routeSchema } from '@/lib/validations'
import { readJson, parseWith } from '@/lib/form-body'

export const PUT = withApiHandler(
  async (request: NextRequest, context, session) => {
    const { id } = context.params
    const schoolFilter = getSchoolFilter(session)

    // Check if route exists and belongs to user's school
    const existingRoute = await prisma.route.findFirst({
      where: {
        id,
        ...schoolFilter,
      },
    })

    if (!existingRoute) {
      return notFoundResponse('Route not found')
    }

    // schoolId is never changed on update; blank description clears the field
    const { schoolId: _ignored, ...body } = await readJson(request)
    if (body.description === '') body.description = null

    const { data, errors } = parseWith(routeSchema.partial(), body)

    if (errors) {
      return validationErrorResponse(errors)
    }

    if (data.code !== undefined || data.name !== undefined) {
      const duplicate = await prisma.route.findFirst({
        where: {
          schoolId: existingRoute.schoolId,
          id: { not: id },
          OR: [
            ...(data.code !== undefined ? [{ code: data.code }] : []),
            ...(data.name !== undefined ? [{ name: data.name }] : []),
          ],
        },
      })
      if (duplicate) {
        return duplicate.code === data.code
          ? errorResponse('A route with this code already exists')
          : errorResponse('A route with this name already exists')
      }
    }

    const updateData: Record<string, unknown> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.code !== undefined) updateData.code = data.code
    if (data.description !== undefined) updateData.description = data.description
    if (data.isActive !== undefined) updateData.isActive = data.isActive

    const route = await prisma.route.update({
      where: { id },
      data: updateData,
      include: {
        _count: { select: { stops: true, vehicles: true, students: true } },
      },
    })

    return successResponse(route)
  },
  { requireAuth: true, module: 'transport' }
)

export const DELETE = withApiHandler(
  async (_request: NextRequest, context, session) => {
    const { id } = context.params
    const schoolFilter = getSchoolFilter(session)

    // Check if route exists and belongs to user's school
    const existingRoute = await prisma.route.findFirst({
      where: {
        id,
        ...schoolFilter,
      },
    })

    if (!existingRoute) {
      return notFoundResponse('Route not found')
    }

    // StudentTransport rows reference the route (and its stops) without cascade
    const assignedStudents = await prisma.studentTransport.count({ where: { routeId: id } })
    if (assignedStudents > 0) {
      return errorResponse(
        `Cannot delete route: ${assignedStudents} student(s) are assigned to it. Reassign them first.`
      )
    }

    await prisma.$transaction([
      prisma.vehicle.updateMany({ where: { routeId: id }, data: { routeId: null } }),
      prisma.route.delete({ where: { id } }),
    ])

    return successResponse({ message: 'Route deleted successfully' })
  },
  { requireAuth: true, module: 'transport' }
)
