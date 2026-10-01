import { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import prisma from '@/lib/prisma'
import { Prisma, UserRole } from '@prisma/client'
import {
  withApiHandler,
  getPaginationParams,
  successResponse,
  errorResponse,
  paginatedResponse,
  validationErrorResponse,
  AuthenticatedSession
} from '@/lib/api-utils'

// Notification rows are per-user. The dashboard page sends and lists
// *broadcasts* (one title/message to an audience), so a broadcast is stored as
// one row per recipient, all sharing a tag in `link`:
//   broadcast:<batchId>:<audience>:<priority>
const BROADCAST_PREFIX = 'broadcast:'
const AUDIENCES = ['ALL', 'STUDENTS', 'PARENTS', 'STAFF', 'TEACHERS']
const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT']

function rolesFor(audience: string): UserRole[] | null {
  switch (audience) {
    case 'STUDENTS':
      return ['STUDENT']
    case 'PARENTS':
      return ['PARENT']
    case 'TEACHERS':
      return ['TEACHER', 'HEAD_TEACHER']
    case 'STAFF':
      return (Object.values(UserRole) as UserRole[]).filter((role) => role !== 'STUDENT' && role !== 'PARENT')
    default:
      return null // everyone
  }
}

function typeFor(priority: string) {
  return priority === 'URGENT' || priority === 'HIGH' ? 'WARNING' : 'INFO'
}

function parseTag(link: string | null) {
  const [, batchId = '', audience = 'ALL', priority = 'NORMAL'] = (link || '').split(':')
  return { batchId, audience, priority }
}

export const GET = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const pagination = getPaginationParams(request)
    const { searchParams } = new URL(request.url)
    const isRead = searchParams.get('isRead')

    // Personal feed: /api/communication/notifications?mine=true[&isRead=false]
    if (searchParams.get('mine') === 'true' || isRead !== null) {
      const where: Prisma.NotificationWhereInput = {
        userId: session!.user.id,
        ...(isRead !== null ? { isRead: isRead === 'true' } : {}),
      }
      const [notifications, total] = await Promise.all([
        prisma.notification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: pagination.skip,
          take: pagination.limit
        }),
        prisma.notification.count({ where })
      ])
      return paginatedResponse(notifications, total, pagination)
    }

    // Default: broadcasts sent within the caller's school, one entry per batch
    const where: Prisma.NotificationWhereInput = {
      link: { startsWith: BROADCAST_PREFIX },
      ...(session!.user.role === 'SUPER_ADMIN' ? {} : { user: { schoolId: session!.user.schoolId } }),
    }

    const batches = await prisma.notification.groupBy({
      by: ['link', 'title', 'message'],
      where,
      _count: { _all: true },
      _min: { createdAt: true },
      orderBy: { _min: { createdAt: 'desc' } },
      take: 500,
    })

    const readCounts = await prisma.notification.groupBy({
      by: ['link'],
      where: { ...where, isRead: true },
      _count: { _all: true },
    })
    const readByLink = new Map(readCounts.map((row) => [row.link, row._count._all]))

    const broadcasts = batches.map((batch) => {
      const tag = parseTag(batch.link)
      return {
        id: tag.batchId || batch.link,
        title: batch.title,
        message: batch.message,
        targetAudience: tag.audience,
        priority: tag.priority,
        status: 'DELIVERED',
        recipientCount: batch._count._all,
        readCount: readByLink.get(batch.link) ?? 0,
        createdAt: batch._min.createdAt,
      }
    })

    return successResponse(broadcasts)
  },
  { requireAuth: true, module: 'communication' }
)

export const POST = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return errorResponse('Invalid request body')
    }

    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const message = typeof body.message === 'string' ? body.message.trim() : ''
    const audience = body.targetAudience === undefined ? 'ALL' : String(body.targetAudience)
    const priority = body.priority === undefined ? 'NORMAL' : String(body.priority)

    const errors: Record<string, string[]> = {}
    if (!title) errors.title = ['Title is required']
    if (!message) errors.message = ['Message is required']
    if (!AUDIENCES.includes(audience)) errors.targetAudience = ['Invalid target audience']
    if (!PRIORITIES.includes(priority)) errors.priority = ['Invalid priority']
    if (Object.keys(errors).length) {
      return validationErrorResponse(errors)
    }

    // Single-recipient notification (original API shape): { userId, title, message }
    if (typeof body.userId === 'string' && body.userId) {
      const recipient = await prisma.user.findFirst({
        where: {
          id: body.userId,
          ...(session!.user.role === 'SUPER_ADMIN' ? {} : { schoolId: session!.user.schoolId }),
        },
        select: { id: true }
      })
      if (!recipient) {
        return validationErrorResponse({ userId: ['User not found'] })
      }
      const notification = await prisma.notification.create({
        data: {
          userId: recipient.id,
          title,
          message,
          type: typeof body.type === 'string' ? body.type : typeFor(priority),
          link: typeof body.link === 'string' ? body.link : null,
        }
      })
      return successResponse(notification, 201)
    }

    // Broadcast to an audience within the sender's school
    const schoolId =
      session!.user.role === 'SUPER_ADMIN' && typeof body.schoolId === 'string' && body.schoolId
        ? body.schoolId
        : session!.user.schoolId
    if (!schoolId) {
      return errorResponse('School ID is required')
    }

    const roles = rolesFor(audience)
    const recipients = await prisma.user.findMany({
      where: { schoolId, isActive: true, ...(roles ? { role: { in: roles } } : {}) },
      select: { id: true }
    })
    if (recipients.length === 0) {
      return errorResponse(
        `No active user accounts found for audience "${audience}" - nothing was sent.`,
        400
      )
    }

    const batchId = randomUUID()
    const link = `${BROADCAST_PREFIX}${batchId}:${audience}:${priority}`
    const createdAt = new Date()

    await prisma.notification.createMany({
      data: recipients.map((user) => ({
        userId: user.id,
        title,
        message,
        type: typeFor(priority),
        link,
        createdAt,
      }))
    })

    return successResponse(
      {
        id: batchId,
        title,
        message,
        targetAudience: audience,
        priority,
        status: 'DELIVERED',
        recipientCount: recipients.length,
        readCount: 0,
        createdAt,
      },
      201
    )
  },
  { requireAuth: true, module: 'communication' }
)
