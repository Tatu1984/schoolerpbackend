import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withApiHandler, successResponse, errorResponse } from '@/lib/api-utils'
import { resolveSchoolId } from '@/lib/school-scope'
import { backupWhere, createBackup, toBackupRow } from '@/lib/backups'

export const dynamic = 'force-dynamic'

// GET /api/security/backups - backup history
export const GET = withApiHandler(
  async (_request: NextRequest, _context, session) => {
    const backups = await prisma.dataBackup.findMany({
      where: backupWhere(session),
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
    return successResponse(backups.map(toBackupRow))
  },
  { requireAuth: true, module: 'security' }
)

// POST /api/security/backups  Body: { type?: 'MANUAL' | ..., schoolId? (super admin only) }
export const POST = withApiHandler(
  async (request: NextRequest, _context, session) => {
    const body = await request.json().catch(() => ({}))

    const schoolId = await resolveSchoolId(session, body?.schoolId)
    if (!schoolId) return errorResponse('No school associated with this account')

    const backupType = String(body?.type || body?.backupType || 'MANUAL').toUpperCase().slice(0, 30)
    const backup = await createBackup(schoolId, backupType)

    if (backup.status !== 'COMPLETED') {
      return errorResponse('Backup failed: the snapshot file could not be written on the server', 500)
    }
    return successResponse(toBackupRow(backup), 201)
  },
  { requireAuth: true, module: 'security' }
)
