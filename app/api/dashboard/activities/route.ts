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

    // Get recent activities from various sources
    const [recentStudents, recentPayments, recentLibraryIssues, recentLeaves] = await Promise.all([
      prisma.student.findMany({
        where: schoolFilter,
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { firstName: true, lastName: true, createdAt: true },
      }),
      prisma.feePayment.findMany({
        where: { ...schoolFilter, paymentDate: { not: null }, paidAmount: { gt: 0 } },
        orderBy: { paymentDate: 'desc' },
        take: 3,
        select: {
          student: { select: { firstName: true, lastName: true } },
          paymentDate: true,
        },
      }),
      prisma.libraryIssue.findMany({
        where: {
          book: {
            library: schoolFilter.schoolId ? { schoolId: schoolFilter.schoolId } : undefined,
          },
        },
        orderBy: { issueDate: 'desc' },
        take: 2,
        select: {
          student: { select: { firstName: true, lastName: true } },
          issueDate: true,
        },
      }),
      prisma.leaveRequest.findMany({
        where: {
          staff: schoolFilter,
          status: 'APPROVED',
        },
        orderBy: { updatedAt: 'desc' },
        take: 2,
        select: {
          staff: { select: { firstName: true, lastName: true } },
          updatedAt: true,
        },
      }),
    ])

    const activities: { action: string; name: string; time: string; at: number }[] = []

    // Helper function to format time ago
    const formatTimeAgo = (date: Date) => {
      const now = new Date()
      const diff = now.getTime() - date.getTime()
      const minutes = Math.floor(diff / 60000)
      const hours = Math.floor(diff / 3600000)
      const days = Math.floor(diff / 86400000)

      if (minutes < 1) return 'Just now'
      if (minutes < 60) return `${minutes} min${minutes > 1 ? 's' : ''} ago`
      if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
      return `${days} day${days > 1 ? 's' : ''} ago`
    }

    // Add recent student admissions
    recentStudents.forEach((student) => {
      activities.push({
        action: 'New student admission',
        name: `${student.firstName} ${student.lastName}`,
        time: formatTimeAgo(student.createdAt),
        at: student.createdAt.getTime(),
      })
    })

    // Add recent payments
    recentPayments.forEach((payment) => {
      if (payment.paymentDate) {
        activities.push({
          action: 'Fee payment received',
          name: `${payment.student.firstName} ${payment.student.lastName}`,
          time: formatTimeAgo(payment.paymentDate),
          at: payment.paymentDate.getTime(),
        })
      }
    })

    // Add library issues
    recentLibraryIssues.forEach((issue) => {
      activities.push({
        action: 'Library book issued',
        name: `${issue.student.firstName} ${issue.student.lastName}`,
        time: formatTimeAgo(issue.issueDate),
        at: issue.issueDate.getTime(),
      })
    })

    // Add approved leaves
    recentLeaves.forEach((leave) => {
      activities.push({
        action: 'Staff leave approved',
        name: `${leave.staff.firstName} ${leave.staff.lastName}`,
        time: formatTimeAgo(leave.updatedAt),
        at: leave.updatedAt.getTime(),
      })
    })

    // Sort by most recent and limit to 5
    const sortedActivities = activities
      .sort((x, y) => y.at - x.at)
      .slice(0, 5)
      .map(({ at, ...activity }) => activity)

    // If no activities, return default
    if (sortedActivities.length === 0) {
      return successResponse([
        { action: 'System ready', name: 'School ERP', time: 'Just now' },
      ])
    }

    return successResponse(sortedActivities)
  },
  { requireAuth: true }
)
