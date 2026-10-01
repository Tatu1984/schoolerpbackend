import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { AdmissionStatus } from '@prisma/client'
import {
  withApiHandler,
  getSchoolFilter,
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
  AuthenticatedSession,
} from '@/lib/api-utils'
import {
  ADMISSION_STATUSES,
  applicationToClient,
  buildCommonUpdate,
  getMeta,
  metaToJson,
} from '../../helpers'

export const GET = withApiHandler(
  async (_request: NextRequest, { params }, session: AuthenticatedSession | null) => {
    const application = await prisma.admission.findFirst({
      where: { id: params.id, ...getSchoolFilter(session) },
    })
    if (!application) {
      return notFoundResponse('Application not found')
    }
    return successResponse(applicationToClient(application))
  },
  { requireAuth: true, module: 'admissions' }
)

export const PUT = withApiHandler(
  async (request: NextRequest, { params }, session: AuthenticatedSession | null) => {
    // Check if application exists and belongs to user's school
    const existing = await prisma.admission.findFirst({
      where: { id: params.id, ...getSchoolFilter(session) },
    })
    if (!existing) {
      return notFoundResponse('Application not found')
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return errorResponse('Invalid request body')
    }

    const { data, errors } = buildCommonUpdate(body)
    if (errors) {
      return validationErrorResponse(errors)
    }

    // The page sends its own status vocabulary (SUBMITTED / UNDER_REVIEW / ...);
    // raw pipeline statuses are accepted too.
    if (body.status !== undefined) {
      const meta = getMeta(existing)
      const status = String(body.status)

      if (status === 'UNDER_REVIEW') {
        meta.underReview = true
        if (existing.status === 'INQUIRY') data.status = 'PROSPECT'
      } else if (status === 'SUBMITTED') {
        delete meta.underReview
        data.status = 'PROSPECT'
      } else if (ADMISSION_STATUSES.includes(status)) {
        data.status = status as AdmissionStatus
        if (status === 'APPROVED') {
          data.approvedBy = session?.user.name || session?.user.email || null
          data.approvalDate = new Date()
          data.rejectionReason = null
        }
        if (status === 'REJECTED') {
          data.rejectionReason = typeof body.rejectionReason === 'string' ? body.rejectionReason : null
        }
      } else {
        return validationErrorResponse({ status: ['Invalid status'] })
      }
      data.documents = metaToJson(meta)
    }

    const application = await prisma.admission.update({
      where: { id: params.id },
      data,
    })

    return successResponse(applicationToClient(application))
  },
  { requireAuth: true, module: 'admissions' }
)

export const DELETE = withApiHandler(
  async (_request: NextRequest, { params }, session: AuthenticatedSession | null) => {
    // Check if application exists and belongs to user's school
    const existing = await prisma.admission.findFirst({
      where: { id: params.id, ...getSchoolFilter(session) },
    })
    if (!existing) {
      return notFoundResponse('Application not found')
    }
    if (existing.studentId) {
      return errorResponse('This applicant is already enrolled as a student and cannot be deleted', 409)
    }

    await prisma.admission.delete({ where: { id: params.id } })

    return successResponse({ message: 'Application deleted successfully' })
  },
  { requireAuth: true, module: 'admissions' }
)
