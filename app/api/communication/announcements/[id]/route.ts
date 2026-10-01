import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  getSchoolFilter,
  successResponse,
  notFoundResponse,
  validateBody,
  validationErrorResponse,
  AuthenticatedSession
} from '@/lib/api-utils'
import { announcementSchema } from '@/lib/validations'
import { Prisma } from '@prisma/client'

export const GET = withApiHandler(
  async (
    request: NextRequest,
    context: { params: Record<string, string> },
    session: AuthenticatedSession | null
  ) => {
    const { id } = context.params
    const schoolFilter = getSchoolFilter(session)

    const announcement = await prisma.announcement.findUnique({
      where: {
        id,
        ...schoolFilter
      }
    })

    if (!announcement) {
      return notFoundResponse('Announcement not found')
    }

    return successResponse(announcement)
  },
  { requireAuth: true, module: 'communication' }
)

export const PUT = withApiHandler(
  async (
    request: NextRequest,
    context: { params: Record<string, string> },
    session: AuthenticatedSession | null
  ) => {
    const { id } = context.params
    const schoolFilter = getSchoolFilter(session)

    // Validate request body
    const validation = await validateBody(request, announcementSchema.partial())
    if (validation.errors) {
      return validationErrorResponse(validation.errors)
    }

    // Check if announcement exists and belongs to user's school
    const existing = await prisma.announcement.findUnique({
      where: { id }
    })

    if (!existing) {
      return notFoundResponse('Announcement not found')
    }

    // Verify school access for non-super admins
    if (session?.user.role !== 'SUPER_ADMIN' && existing.schoolId !== session?.user.schoolId) {
      return notFoundResponse('Announcement not found')
    }

    const data = validation.data!
    // schoolId is never changed by an edit (the form resends it)
    const { attachments, publishedAt, priority, targetRole, targetClass, schoolId: _schoolId, ...restData } = data

    const updateData: Prisma.AnnouncementUpdateInput = {
      ...restData,
      ...(publishedAt && { publishedAt: new Date(publishedAt) }),
      ...(priority !== undefined && priority !== null && { priority }),
      ...(targetRole !== undefined && targetRole !== null && { targetRole }),
      ...(targetClass !== undefined && targetClass !== null && { targetClass }),
    }

    if (attachments !== undefined) {
      updateData.attachments = attachments === null
        ? Prisma.JsonNull
        : (attachments as Prisma.InputJsonValue)
    }

    const announcement = await prisma.announcement.update({
      where: { id },
      data: updateData
    })

    return successResponse(announcement)
  },
  { requireAuth: true, module: 'communication' }
)

export const DELETE = withApiHandler(
  async (
    request: NextRequest,
    context: { params: Record<string, string> },
    session: AuthenticatedSession | null
  ) => {
    const { id } = context.params
    const schoolFilter = getSchoolFilter(session)

    // Check if announcement exists and belongs to user's school
    const existing = await prisma.announcement.findUnique({
      where: { id }
    })

    if (!existing) {
      return notFoundResponse('Announcement not found')
    }

    // Verify school access for non-super admins
    if (session?.user.role !== 'SUPER_ADMIN' && existing.schoolId !== session?.user.schoolId) {
      return notFoundResponse('Announcement not found')
    }

    await prisma.announcement.delete({
      where: { id }
    })

    return successResponse({ success: true })
  },
  { requireAuth: true, module: 'communication' }
)
