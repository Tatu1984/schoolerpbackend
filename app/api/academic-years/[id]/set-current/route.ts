import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  getSchoolFilter,
  successResponse,
  notFoundResponse
} from '@/lib/api-utils'
import { logAudit } from '@/lib/audit'

export const POST = withApiHandler(
  async (request: NextRequest, { params }, session) => {
    const schoolFilter = getSchoolFilter(session)

    // Check if academic year exists and user has access
    const year = await prisma.academicYear.findFirst({
      where: {
        id: params.id,
        ...schoolFilter
      }
    })

    if (!year) {
      return notFoundResponse('Academic year not found')
    }

    // Unset all current years for this school, then set this one
    const [, updatedYear] = await prisma.$transaction([
      prisma.academicYear.updateMany({
        where: { schoolId: year.schoolId },
        data: { isCurrent: false }
      }),
      prisma.academicYear.update({
        where: { id: params.id },
        data: { isCurrent: true },
        include: {
          school: { select: { id: true, name: true } }
        }
      }),
    ])

    await logAudit(session, request, 'UPDATE', 'AcademicYear', params.id, { isCurrent: true })

    return successResponse(updatedYear)
  },
  { requireAuth: true, module: 'academic-years' }
)
