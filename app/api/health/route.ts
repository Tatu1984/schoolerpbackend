import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/health -> liveness + database connectivity
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ success: true, data: { status: 'ok', database: 'up' } })
  } catch {
    return NextResponse.json({ success: false, error: 'Database unreachable' }, { status: 503 })
  }
}
