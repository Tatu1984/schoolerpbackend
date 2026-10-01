import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  successResponse,
  notFoundResponse,
  forbiddenResponse,
  AuthenticatedSession
} from '@/lib/api-utils'

export const PUT = withApiHandler(
  async (
    request: NextRequest,
    context: { params: Record<string, string> },
    session: AuthenticatedSession | null
  ) => {
    const { id } = context.params

    // Check if message exists
    const message = await prisma.message.findUnique({
      where: { id }
    })

    if (!message) {
      return notFoundResponse('Message not found')
    }

    // Verify user is the receiver
    if (message.receiverId !== session?.user.id) {
      return forbiddenResponse('You can only mark your own messages as read')
    }

    // Mark message as read
    const updatedMessage = await prisma.message.update({
      where: { id },
      data: { isRead: true }
    })

    return successResponse(updatedMessage)
  },
  { requireAuth: true, module: 'communication' }
)
