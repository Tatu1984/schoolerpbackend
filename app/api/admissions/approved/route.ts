import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import {
  withApiHandler,
  getSchoolFilter,
  paginatedResponse,
} from '@/lib/api-utils'
import { applicationToClient, getListParams } from '../helpers'

export const GET = withApiHandler(
  async (request: NextRequest, _context, session) => {
    const pagination = getListParams(request)

    // ADMITTED rows are approved applications that have already been enrolled
    const where: Prisma.AdmissionWhereInput = {
      ...getSchoolFilter(session),
      status: { in: ['APPROVED', 'ADMITTED'] },
    }

    const [approved, total] = await Promise.all([
      prisma.admission.findMany({
        where,
        orderBy: [{ approvalDate: 'desc' }, { updatedAt: 'desc' }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.admission.count({ where }),
    ])

    return paginatedResponse(approved.map(applicationToClient), total, pagination)
  },
  { requireAuth: true, module: 'admissions' }
)
