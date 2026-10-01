import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  getSchoolFilter,
  successResponse,
  validationErrorResponse,
  validateBody,
  notFoundResponse,
  AuthenticatedSession,
} from '@/lib/api-utils'
import { menuItemSchema } from '@/lib/validations'

export const GET = withApiHandler(
  async (_request: NextRequest, context, session: AuthenticatedSession | null) => {
    const { id } = context.params
    const schoolFilter = getSchoolFilter(session)

    const menuItem = await prisma.menuItem.findFirst({
      where: {
        id,
        ...schoolFilter,
      },
    })

    if (!menuItem) {
      return notFoundResponse('Menu item not found')
    }

    return successResponse(menuItem)
  },
  { requireAuth: true, module: 'canteen' }
)

export const PUT = withApiHandler(
  async (request: NextRequest, context, session: AuthenticatedSession | null) => {
    const { id } = context.params
    const schoolFilter = getSchoolFilter(session)

    // Check if menu item exists and belongs to school
    const existingItem = await prisma.menuItem.findFirst({
      where: {
        id,
        ...schoolFilter,
      },
    })

    if (!existingItem) {
      return notFoundResponse('Menu item not found')
    }

    const { data, errors } = await validateBody(request, menuItemSchema.partial())

    if (errors) {
      return validationErrorResponse(errors)
    }

    // An item stays in its school (the form resends schoolId on edit)
    const { schoolId: _schoolId, ...updateData } = data!

    const menuItem = await prisma.menuItem.update({
      where: { id },
      data: updateData,
    })

    return successResponse(menuItem)
  },
  { requireAuth: true, module: 'canteen' }
)

export const DELETE = withApiHandler(
  async (_request: NextRequest, context, session: AuthenticatedSession | null) => {
    const { id } = context.params
    const schoolFilter = getSchoolFilter(session)

    // Check if menu item exists and belongs to school
    const existingItem = await prisma.menuItem.findFirst({
      where: {
        id,
        ...schoolFilter,
      },
    })

    if (!existingItem) {
      return notFoundResponse('Menu item not found')
    }

    // Soft delete by setting isActive to false
    await prisma.menuItem.update({
      where: { id },
      data: { isActive: false },
    })

    return successResponse({ success: true })
  },
  { requireAuth: true, module: 'canteen' }
)
