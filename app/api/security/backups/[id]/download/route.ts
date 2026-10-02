import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import prisma from '@/lib/prisma'
import { withApiHandler, errorResponse, notFoundResponse } from '@/lib/api-utils'
import { backupWhere, resolveBackupPath } from '@/lib/backups'

export const dynamic = 'force-dynamic'

// GET /api/security/backups/[id]/download - streams the JSON snapshot as an attachment
export const GET = withApiHandler(
  async (_request: NextRequest, { params }, session) => {
    const backup = await prisma.dataBackup.findFirst({
      where: { id: params.id, ...backupWhere(session) },
    })
    if (!backup) return notFoundResponse('Backup not found')
    if (backup.status !== 'COMPLETED') return errorResponse('This backup did not complete and has no file')

    const filePath = resolveBackupPath(backup)
    const contents = filePath ? await fs.readFile(filePath).catch(() => null) : null
    if (!contents) return notFoundResponse('Backup file is no longer available on the server')

    return new NextResponse(contents, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${backup.fileName}"`,
        'Content-Length': String(contents.length),
        'Cache-Control': 'no-store',
      },
    })
  },
  { requireAuth: true, module: 'security' }
)
