import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import {
  withApiHandler,
  getSchoolFilter,
  paginatedResponse,
  successResponse,
  errorResponse,
  validationErrorResponse,
  AuthenticatedSession,
} from '@/lib/api-utils'
import {
  createAdmission,
  getListParams,
  getMeta,
  INTERVIEW_STATUSES,
  InterviewMeta,
  interviewToClient,
  metaToJson,
  resolveSchoolId,
  splitName,
} from '../helpers'

export const GET = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const pagination = getListParams(request)

    const where: Prisma.AdmissionWhereInput = {
      ...getSchoolFilter(session),
      interviewDate: { not: null },
    }

    const [interviews, total] = await Promise.all([
      prisma.admission.findMany({
        where,
        orderBy: { interviewDate: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.admission.count({ where }),
    ])

    return paginatedResponse(interviews.map(interviewToClient), total, pagination)
  },
  { requireAuth: true, module: 'admissions' }
)

// The form schedules an interview by applicant name. If an open applicant with
// that name exists in the school the interview is attached to it; otherwise a
// new admission record is started for the applicant.
export const POST = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return errorResponse('Invalid request body')
    }

    const schoolId = resolveSchoolId(session, body.schoolId)
    if (!schoolId) {
      return errorResponse('School ID is required')
    }

    const studentName = typeof body.studentName === 'string' ? body.studentName.trim() : ''
    const date = typeof body.interviewDate === 'string' ? body.interviewDate.split('T')[0] : ''
    const time = typeof body.interviewTime === 'string' ? body.interviewTime : ''
    const interviewDate = date ? new Date(`${date}T${time || '00:00'}`) : null

    const errors: Record<string, string[]> = {}
    if (!studentName) errors.studentName = ['Student name is required']
    if (!interviewDate || isNaN(interviewDate.getTime())) errors.interviewDate = ['A valid interview date is required']
    if (Object.keys(errors).length) {
      return validationErrorResponse(errors)
    }

    const interview: InterviewMeta = {
      date,
      time,
      interviewer: typeof body.interviewer === 'string' ? body.interviewer.trim() : '',
      venue: typeof body.venue === 'string' ? body.venue.trim() : '',
      status: INTERVIEW_STATUSES.includes(body.status) ? body.status : 'SCHEDULED',
    }
    const notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null
    const { firstName, lastName } = splitName(studentName)

    const applicant = await prisma.admission.findFirst({
      where: {
        schoolId,
        firstName: { equals: firstName, mode: 'insensitive' },
        lastName: { equals: lastName, mode: 'insensitive' },
        interviewDate: null,
        status: { notIn: ['ADMITTED', 'REJECTED', 'CANCELLED'] },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (applicant) {
      const advance = ['INQUIRY', 'PROSPECT', 'TEST_SCHEDULED', 'TEST_COMPLETED'].includes(applicant.status)
      const updated = await prisma.admission.update({
        where: { id: applicant.id },
        data: {
          interviewDate: interviewDate!,
          interviewNotes: notes,
          ...(advance ? { status: 'INTERVIEW_SCHEDULED' as const } : {}),
          documents: metaToJson({
            ...getMeta(applicant),
            interview: { ...interview, previousStatus: applicant.status },
          }),
        },
      })
      return successResponse(interviewToClient(updated), 201)
    }

    const result = await createAdmission(
      session,
      {
        schoolId,
        firstName,
        lastName,
        parentName: body.parentName,
        parentPhone: body.contactPhone ?? body.parentPhone,
      },
      {
        status: 'INTERVIEW_SCHEDULED',
        allowMissingDetails: true,
        meta: { interview: { ...interview, createdByInterview: true } },
        extra: { interviewDate: interviewDate!, interviewNotes: notes },
      }
    )
    if (result.errors) {
      // surface under the field names the form uses
      const { parentPhone, firstName: first, ...rest } = result.errors
      return validationErrorResponse({
        ...rest,
        ...(parentPhone ? { contactPhone: parentPhone } : {}),
        ...(first ? { studentName: first } : {}),
      })
    }

    return successResponse(interviewToClient(result.admission), 201)
  },
  { requireAuth: true, module: 'admissions' }
)
