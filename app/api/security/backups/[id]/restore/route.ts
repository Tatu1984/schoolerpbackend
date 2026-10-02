import { NextRequest } from 'next/server'
import { promises as fs } from 'fs'
import prisma from '@/lib/prisma'
import { withApiHandler, successResponse, notFoundResponse } from '@/lib/api-utils'
import { backupWhere, resolveBackupPath } from '@/lib/backups'

export const dynamic = 'force-dynamic'

// POST /api/security/backups/[id]/restore
// Still a stub: it checks the backup exists and its file is readable, but it does
// NOT write anything back to the database. `restored: false` says so explicitly.
export const POST = withApiHandler(
  async (_request: NextRequest, { params }, session) => {
    const backup = await prisma.dataBackup.findFirst({
      where: { id: params.id, ...backupWhere(session) },
    })
    if (!backup) return notFoundResponse('Backup not found')

    const filePath = resolveBackupPath(backup)
    const fileAvailable = filePath ? await fs.access(filePath).then(() => true, () => false) : false

    return successResponse({
      id: backup.id,
      restored: false,
      fileAvailable,
      message: fileAvailable
        ? 'Backup verified. Automatic restore is not enabled - no data was changed. Download the backup to restore manually.'
        : 'Backup record found but its file is not on this server. No data was changed.',
    })
  },
  { requireAuth: true, module: 'security' }
)
