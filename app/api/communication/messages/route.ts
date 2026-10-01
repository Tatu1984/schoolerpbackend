import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import {
  withApiHandler,
  getPaginationParams,
  successResponse,
  errorResponse,
  paginatedResponse,
  validationErrorResponse,
  AuthenticatedSession
} from '@/lib/api-utils'

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true
}

const include = {
  sender: { select: userSelect },
  receiver: { select: userSelect }
}

type MessageWithUsers = Prisma.MessageGetPayload<{ include: typeof include }>

function fullName(user: { firstName: string; lastName: string; email: string }) {
  return `${user.firstName} ${user.lastName}`.trim() || user.email
}

// Adds the flat names the messages page renders (senderName, recipientName, message).
function toClient(message: MessageWithUsers) {
  return {
    ...message,
    senderName: fullName(message.sender),
    recipientName: fullName(message.receiver),
    message: message.content,
  }
}

// The compose box takes a free-text "name or email". Resolve it to one user in
// the sender's school (super admins may address any user by email).
async function resolveRecipient(to: string, session: AuthenticatedSession) {
  const value = to.trim().replace(/\s+/g, ' ')
  const schoolScope = session.user.role === 'SUPER_ADMIN' ? {} : { schoolId: session.user.schoolId }
  const base = { isActive: true, ...schoolScope }

  const byIdOrEmail = await prisma.user.findFirst({
    where: { ...base, OR: [{ id: value }, { email: { equals: value, mode: 'insensitive' } }] },
    select: { id: true }
  })
  if (byIdOrEmail) return { id: byIdOrEmail.id }

  const [first, ...rest] = value.split(' ')
  const last = rest.join(' ')
  const matches = await prisma.user.findMany({
    where: {
      ...base,
      firstName: { equals: first, mode: 'insensitive' },
      ...(last ? { lastName: { equals: last, mode: 'insensitive' } } : {}),
    },
    select: { id: true },
    take: 2
  })

  if (matches.length === 1) return { id: matches[0].id }
  if (matches.length > 1) {
    return { error: `More than one user is named "${value}". Use their email address instead.` }
  }
  return { error: `No user found matching "${value}". Enter the recipient's full name or email.` }
}

export const GET = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'inbox'
    const pagination = getPaginationParams(request)

    // The page lists the whole mailbox and counts unread from it
    if (!searchParams.has('limit')) {
      pagination.limit = 500
      pagination.skip = (pagination.page - 1) * pagination.limit
    }

    // Only ever the caller's own mailbox
    const where: Prisma.MessageWhereInput =
      type === 'sent' ? { senderId: session!.user.id } : { receiverId: session!.user.id }

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        include,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit
      }),
      prisma.message.count({ where })
    ])

    return paginatedResponse(messages.map(toClient), total, pagination)
  },
  { requireAuth: true, module: 'communication' }
)

export const POST = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return errorResponse('Invalid request body')
    }

    // Page sends { to, subject, message }; { receiverId, content } also accepted.
    // The sender is always the authenticated user.
    const to = typeof (body.to ?? body.receiverId) === 'string' ? String(body.to ?? body.receiverId) : ''
    const content = typeof (body.message ?? body.content) === 'string' ? String(body.message ?? body.content).trim() : ''
    const subject = typeof body.subject === 'string' && body.subject.trim() ? body.subject.trim() : null

    const errors: Record<string, string[]> = {}
    if (!to.trim()) errors.to = ['Recipient is required']
    if (!content) errors.message = ['Message is required']
    if (Object.keys(errors).length) {
      return validationErrorResponse(errors)
    }

    const recipient = await resolveRecipient(to, session!)
    if (!recipient.id) {
      return errorResponse(recipient.error || 'Recipient not found', 404)
    }

    const message = await prisma.message.create({
      data: {
        senderId: session!.user.id,
        receiverId: recipient.id,
        subject,
        content,
      },
      include
    })

    return successResponse(toClient(message), 201)
  },
  { requireAuth: true, module: 'communication' }
)
