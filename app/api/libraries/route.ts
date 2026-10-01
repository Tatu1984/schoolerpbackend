import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withApiHandler, successResponse, errorResponse } from '@/lib/api-utils'
import { schoolWhere, resolveSchoolId } from '@/lib/school-scope'

// GET /api/libraries
export const GET = withApiHandler(
  async (_request: NextRequest, _context, session) => {
    const libraries = await prisma.library.findMany({
      where: schoolWhere(session),
      include: { _count: { select: { books: true } } },
      orderBy: { name: 'asc' },
    })
    return successResponse(libraries)
  },
  { requireAuth: true, module: 'library' }
)

// POST /api/libraries
export const POST = withApiHandler(
  async (request: NextRequest, _context, session) => {
    const body = await request.json().catch(() => null)
    if (!body) return errorResponse('Invalid request body')

    const name = String(body.name || '').trim()
    if (!name) return errorResponse('Library name is required')

    const schoolId = await resolveSchoolId(session, body.schoolId)
    if (!schoolId) return errorResponse('No school associated with this account')

    const code = String(body.code || '').trim() || `LIB-${Date.now().toString(36).toUpperCase()}`
    const duplicate = await prisma.library.findFirst({ where: { schoolId, code }, select: { id: true } })
    if (duplicate) return errorResponse('A library with this code already exists')

    const library = await prisma.library.create({
      data: {
        schoolId,
        name,
        code,
        location: body.location ? String(body.location) : null,
        isActive: typeof body.isActive === 'boolean' ? body.isActive : true,
      },
    })
    return successResponse(library, 201)
  },
  { requireAuth: true, module: 'library' }
)
