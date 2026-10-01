import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  successResponse,
  getSchoolFilter,
  AuthenticatedSession,
} from '@/lib/api-utils'

export const GET = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const schoolFilter = getSchoolFilter(session)

    // Get upcoming events
    const upcomingEvents = await prisma.event.findMany({
      where: {
        ...schoolFilter,
        eventDate: { gte: new Date() },
        isActive: true,
      },
      orderBy: { eventDate: 'asc' },
      take: 5,
      select: {
        id: true,
        title: true,
        eventDate: true,
        location: true,
      },
    })

    const events = upcomingEvents.map((event) => {
      const date = new Date(event.eventDate)
      return {
        title: event.title,
        date: date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        time: date.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }),
      }
    })

    // If no events, return default upcoming events
    if (events.length === 0) {
      return successResponse([
        { title: 'No upcoming events', date: 'N/A', time: '' },
      ])
    }

    return successResponse(events)
  },
  { requireAuth: true }
)
