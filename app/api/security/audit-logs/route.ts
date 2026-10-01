import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  getSchoolFilter,
  successResponse,
  hasMinimumRole,
  errorResponse,
  AuthenticatedSession
} from '@/lib/api-utils'

export const GET = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    // Role check
    if (!session || !hasMinimumRole(session.user.role, 'SCHOOL_ADMIN')) {
      return errorResponse('Access denied', 403)
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const userId = searchParams.get('userId')
    const entity = searchParams.get('entity')
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') || '200', 10) || 200))

    // AuditLog doesn't have schoolId - filter by users in the school instead
    const schoolFilter = getSchoolFilter(session)

    const where: Record<string, unknown> = {}
    if (action) where.action = action
    if (userId) where.userId = userId
    if (entity) where.entity = entity

    // Filter audit logs by users belonging to the school
    if (session.user.role !== 'SUPER_ADMIN') {
      where.user = { schoolId: schoolFilter.schoolId || '__no_school__' }
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true
          }
        }
      }
    })

    // userName / userEmail are what the audit page shows and searches on
    return successResponse(
      logs.map((log) => ({
        ...log,
        userName: log.user ? `${log.user.firstName} ${log.user.lastName}`.trim() : null,
        userEmail: log.user?.email || null,
      }))
    )
  },
  { requireAuth: true, module: 'security' }
)

export const POST = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    // Role check
    if (!session || !hasMinimumRole(session.user.role, 'SCHOOL_ADMIN')) {
      return errorResponse('Access denied', 403)
    }

    let body
    try {
      body = await request.json()
    } catch {
      return errorResponse('Invalid JSON in request body', 400)
    }

    const { action, entity, entityId, changes, ipAddress, userAgent } = body

    // Validate required fields
    if (!action) {
      return errorResponse('action is required', 400)
    }
    if (!entity) {
      return errorResponse('entity is required', 400)
    }

    // AuditLog model doesn't have schoolId - just create the log
    const log = await prisma.auditLog.create({
      data: {
        // Entries are always attributed to the signed-in user
        userId: session.user.id,
        action,
        entity,
        entityId,
        changes,
        ipAddress,
        userAgent,
      }
    })

    return successResponse(log, 201)
  },
  { requireAuth: true, module: 'security' }
)
