import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { AdmissionStatus, Prisma } from '@prisma/client'
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
  getInterviewMeta,
  getMeta,
  INTERVIEW_STATUSES,
  interviewToClient,
  metaToJson,
  splitName,
} from '../../helpers'

export const GET = withApiHandler(
  async (_request: NextRequest, { params }, session: AuthenticatedSession | null) => {
    const interview = await prisma.admission.findFirst({
      where: { id: params.id, ...getSchoolFilter(session) },
    })
    if (!interview) {
      return notFoundResponse('Interview record not found')
    }
    return successResponse(interviewToClient(interview))
  },
  { requireAuth: true, module: 'admissions' }
)

// Body may be the full form or just { status } (the "mark completed" button).
// `status` is the interview's status, not the admission pipeline stage.
export const PUT = withApiHandler(
  async (request: NextRequest, { params }, session: AuthenticatedSession | null) => {
    // Check if interview record exists and belongs to user's school
    const existing = await prisma.admission.findFirst({
      where: { id: params.id, ...getSchoolFilter(session) },
    })
    if (!existing) {
      return notFoundResponse('Interview record not found')
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return errorResponse('Invalid request body')
    }

    const errors: Record<string, string[]> = {}
    const data: Prisma.AdmissionUncheckedUpdateInput = {}
    const interview = getInterviewMeta(existing)

    if (body.studentName !== undefined) {
      const { firstName, lastName } = splitName(String(body.studentName))
      if (!firstName) errors.studentName = ['Student name is required']
      else {
        data.firstName = firstName
        data.lastName = lastName
      }
    }
    if (body.parentName !== undefined) {
      const parentName = String(body.parentName).trim()
      if (!parentName) errors.parentName = ['Parent name is required']
      else data.parentName = parentName
    }
    const phone = body.contactPhone ?? body.parentPhone
    if (phone !== undefined) {
      const parentPhone = String(phone).trim()
      if (!parentPhone) errors.contactPhone = ['Contact phone is required']
      else data.parentPhone = parentPhone
    }

    if (body.interviewDate !== undefined || body.interviewTime !== undefined) {
      const current = interviewToClient(existing)
      const date =
        typeof body.interviewDate === 'string' && body.interviewDate
          ? body.interviewDate.split('T')[0]
          : (current.interviewDate || '').split('T')[0]
      const time = typeof body.interviewTime === 'string' ? body.interviewTime : current.interviewTime
      const interviewDate = date ? new Date(`${date}T${time || '00:00'}`) : null
      if (!interviewDate || isNaN(interviewDate.getTime())) {
        errors.interviewDate = ['A valid interview date is required']
      } else {
        data.interviewDate = interviewDate
        interview.date = date
        interview.time = time
      }
    }

    if (body.interviewer !== undefined) interview.interviewer = String(body.interviewer ?? '').trim()
    if (body.venue !== undefined) interview.venue = String(body.venue ?? '').trim()
    if (body.status !== undefined) {
      if (!INTERVIEW_STATUSES.includes(body.status)) errors.status = ['Invalid interview status']
      else interview.status = body.status
    }
    if (body.notes !== undefined) {
      data.interviewNotes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null
    }

    if (Object.keys(errors).length) {
      return validationErrorResponse(errors)
    }

    data.documents = metaToJson({ ...getMeta(existing), interview })

    const updated = await prisma.admission.update({
      where: { id: params.id },
      data,
    })

    return successResponse(interviewToClient(updated))
  },
  { requireAuth: true, module: 'admissions' }
)

// Removes the interview. The applicant's admission record is only deleted when
// the interview form created it; otherwise the interview is detached from it.
export const DELETE = withApiHandler(
  async (_request: NextRequest, { params }, session: AuthenticatedSession | null) => {
    // Check if interview record exists and belongs to user's school
    const existing = await prisma.admission.findFirst({
      where: { id: params.id, ...getSchoolFilter(session) },
    })
    if (!existing) {
      return notFoundResponse('Interview record not found')
    }

    const interview = getInterviewMeta(existing)

    if (interview.createdByInterview && !existing.studentId) {
      await prisma.admission.delete({ where: { id: params.id } })
    } else {
      const meta = getMeta(existing)
      delete meta.interview
      const previous =
        interview.previousStatus && ADMISSION_STATUSES.includes(interview.previousStatus)
          ? (interview.previousStatus as AdmissionStatus)
          : 'PROSPECT'

      await prisma.admission.update({
        where: { id: params.id },
        data: {
          interviewDate: null,
          interviewNotes: null,
          documents: Object.keys(meta).length ? metaToJson(meta) : Prisma.DbNull,
          ...(existing.status === 'INTERVIEW_SCHEDULED' ? { status: previous } : {}),
        },
      })
    }

    return successResponse({ message: 'Interview deleted successfully' })
  },
  { requireAuth: true, module: 'admissions' }
)
