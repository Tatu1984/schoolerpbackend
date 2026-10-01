import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import type { AuthenticatedSession } from '@/lib/api-utils'

/**
 * Best-effort audit trail entry. Never throws: a failed audit write must not
 * fail the request that triggered it.
 */
export async function logAudit(
  session: AuthenticatedSession | null,
  request: NextRequest | null,
  action: 'CREATE' | 'UPDATE' | 'DELETE' | string,
  entity: string,
  entityId?: string | null,
  changes?: unknown
): Promise<void> {
  try {
    const forwarded = request?.headers.get('x-forwarded-for')
    await prisma.auditLog.create({
      data: {
        userId: session?.user.id || null,
        action,
        entity,
        entityId: entityId || null,
        changes:
          changes === undefined || changes === null
            ? Prisma.JsonNull
            : (JSON.parse(JSON.stringify(changes)) as Prisma.InputJsonValue),
        ipAddress: forwarded ? forwarded.split(',')[0].trim() : request?.headers.get('x-real-ip') || null,
        userAgent: request?.headers.get('user-agent') || null,
      },
    })
  } catch (error) {
    console.error('Audit log write failed:', error)
  }
}
