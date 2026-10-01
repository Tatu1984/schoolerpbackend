import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  successResponse,
  notFoundResponse,
  forbiddenResponse,
  AuthenticatedSession
} from '@/lib/api-utils'

export const DELETE = withApiHandler(
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

    // Verify user is sender or receiver
    if (message.senderId !== session?.user.id && message.receiverId !== session?.user.id) {
      return forbiddenResponse('You do not have permission to delete this message')
    }

    await prisma.message.delete({
      where: { id }
    })

    return successResponse({ success: true })
  },
  { requireAuth: true, module: 'communication' }
)
