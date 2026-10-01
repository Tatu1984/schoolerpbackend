import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { Admission, AdmissionStatus, Gender, Prisma } from '@prisma/client'
import { AuthenticatedSession, getPaginationParams, PaginationParams } from '@/lib/api-utils'

export const ADMISSION_STATUSES = Object.values(AdmissionStatus) as string[]
const GENDERS = Object.values(Gender) as string[]

// The admissions dashboard pages render whole lists (and compute their stat
// cards from them) without paging, so only page when the caller asks for it.
export function getListParams(request: NextRequest): PaginationParams {
  const pagination = getPaginationParams(request)
  if (!new URL(request.url).searchParams.has('limit')) {
    pagination.limit = 1000
    pagination.skip = (pagination.page - 1) * pagination.limit
  }
  return pagination
}

// Non super-admins always act on their own school.
export function resolveSchoolId(session: AuthenticatedSession | null, bodySchoolId: unknown) {
  const fromBody = typeof bodySchoolId === 'string' && bodySchoolId ? bodySchoolId : undefined
  if (session?.user.role === 'SUPER_ADMIN') return fromBody || session.user.schoolId
  return session?.user.schoolId || fromBody
}

// Requested year (if it belongs to the school) -> current year -> most recent year.
export async function resolveAcademicYearId(schoolId: string, requested?: unknown) {
  if (typeof requested === 'string' && requested) {
    const year = await prisma.academicYear.findFirst({ where: { id: requested, schoolId } })
    if (year) return year.id
  }
  const year =
    (await prisma.academicYear.findFirst({ where: { schoolId, isCurrent: true } })) ||
    (await prisma.academicYear.findFirst({ where: { schoolId }, orderBy: { startDate: 'desc' } }))
  return year?.id ?? null
}

export function newInquiryNumber() {
  return `INQ${Date.now()}${Math.floor(Math.random() * 90 + 10)}`
}

// Page-only attributes with no column on Admission (prospect source/status,
// interview venue, ...) live inside the `documents` JSON column.
export type AdmissionMeta = Record<string, unknown>

export function getMeta(admission: { documents: Prisma.JsonValue | null }): AdmissionMeta {
  const docs = admission.documents
  return docs && typeof docs === 'object' && !Array.isArray(docs) ? { ...(docs as AdmissionMeta) } : {}
}

export function metaToJson(meta: AdmissionMeta) {
  return meta as Prisma.InputJsonObject
}

export function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') }
}

// Aliases the admissions pages read (applicationNumber, studentName, ...).
export function withAliases<T extends Admission>(admission: T) {
  return {
    ...admission,
    studentName: `${admission.firstName} ${admission.lastName}`.trim(),
    applicationNumber: admission.inquiryNumber,
    classAppliedFor: admission.appliedClass,
    classInterested: admission.appliedClass,
  }
}

function str(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function parseDate(value: unknown): Date | null {
  if (!value) return null
  const date = new Date(value as string)
  return isNaN(date.getTime()) ? null : date
}

interface CreateOptions {
  status: AdmissionStatus
  meta?: AdmissionMeta
  // Interview scheduling only knows a name and a phone number
  allowMissingDetails?: boolean
  extra?: Partial<Prisma.AdmissionUncheckedCreateInput>
}

// Shared create used by inquiries, prospects, applications and interviews.
export async function createAdmission(
  session: AuthenticatedSession | null,
  body: Record<string, unknown>,
  options: CreateOptions
): Promise<{ admission: Admission; errors?: undefined } | { admission?: undefined; errors: Record<string, string[]> }> {
  const errors: Record<string, string[]> = {}

  const schoolId = resolveSchoolId(session, body.schoolId)
  if (!schoolId) return { errors: { schoolId: ['School is required'] } }

  const firstName = str(body.firstName)
  const lastName = str(body.lastName)
  const parentName = str(body.parentName)
  const parentPhone = str(body.parentPhone)
  const appliedClass = str(body.appliedClass) || str(body.classInterested) || str(body.classAppliedFor)
  const dateOfBirth = parseDate(body.dateOfBirth)
  const gender = GENDERS.includes(body.gender as string) ? (body.gender as Gender) : 'OTHER'
  const parentEmail = str(body.parentEmail)

  if (!firstName) errors.firstName = ['First name is required']
  if (!parentName) errors.parentName = ['Parent name is required']
  if (!parentPhone) errors.parentPhone = ['Parent phone is required']
  if (!options.allowMissingDetails) {
    if (!lastName) errors.lastName = ['Last name is required']
    if (!dateOfBirth) errors.dateOfBirth = ['A valid date of birth is required']
    if (!appliedClass) errors.appliedClass = ['Class is required']
  }
  if (parentEmail && !/^\S+@\S+\.\S+$/.test(parentEmail)) errors.parentEmail = ['Invalid email address']
  if (Object.keys(errors).length) return { errors }

  const academicYearId = await resolveAcademicYearId(schoolId, body.academicYearId)
  if (!academicYearId) {
    return { errors: { academicYearId: ['No academic year found for this school. Create one first.'] } }
  }

  let inquiryNumber = str(body.inquiryNumber) || newInquiryNumber()
  const clash = await prisma.admission.findFirst({ where: { schoolId, inquiryNumber }, select: { id: true } })
  if (clash) inquiryNumber = newInquiryNumber()

  const admission = await prisma.admission.create({
    data: {
      schoolId,
      academicYearId,
      inquiryNumber,
      firstName,
      lastName,
      // dateOfBirth is mandatory in the schema; interview-only records have none yet
      dateOfBirth: dateOfBirth ?? new Date(),
      gender,
      parentName,
      parentPhone,
      parentEmail: parentEmail || null,
      address: str(body.address) || null,
      appliedClass,
      previousSchool: str(body.previousSchool) || null,
      notes: str(body.notes) || null,
      followUpDate: parseDate(body.followUpDate),
      status: options.status,
      ...(options.meta && Object.keys(options.meta).length ? { documents: metaToJson(options.meta) } : {}),
      ...options.extra,
    },
  })

  return { admission }
}

// Plain column updates shared by the prospect/application/interview editors.
// Only keys present in the body are touched.
export function buildCommonUpdate(body: Record<string, unknown>) {
  const errors: Record<string, string[]> = {}
  const data: Prisma.AdmissionUncheckedUpdateInput = {}

  const required: Array<['firstName' | 'lastName' | 'parentName' | 'parentPhone', string]> = [
    ['firstName', 'First name'],
    ['lastName', 'Last name'],
    ['parentName', 'Parent name'],
    ['parentPhone', 'Parent phone'],
  ]
  for (const [key, label] of required) {
    if (body[key] !== undefined) {
      const value = str(body[key])
      if (!value) errors[key] = [`${label} is required`]
      else data[key] = value
    }
  }

  if (body.dateOfBirth !== undefined) {
    const dateOfBirth = parseDate(body.dateOfBirth)
    if (!dateOfBirth) errors.dateOfBirth = ['A valid date of birth is required']
    else data.dateOfBirth = dateOfBirth
  }
  if (body.gender !== undefined) {
    if (!GENDERS.includes(body.gender as string)) errors.gender = ['Invalid gender']
    else data.gender = body.gender as Gender
  }
  if (body.parentEmail !== undefined) {
    const parentEmail = str(body.parentEmail)
    if (parentEmail && !/^\S+@\S+\.\S+$/.test(parentEmail)) errors.parentEmail = ['Invalid email address']
    else data.parentEmail = parentEmail || null
  }
  const appliedClass = body.appliedClass ?? body.classInterested ?? body.classAppliedFor
  if (appliedClass !== undefined) {
    if (!str(appliedClass)) errors.appliedClass = ['Class is required']
    else data.appliedClass = str(appliedClass)
  }
  if (body.address !== undefined) data.address = str(body.address) || null
  if (body.previousSchool !== undefined) data.previousSchool = str(body.previousSchool) || null
  if (body.notes !== undefined) data.notes = str(body.notes) || null
  if (body.followUpDate !== undefined) data.followUpDate = parseDate(body.followUpDate)

  return { data, errors: Object.keys(errors).length ? errors : null }
}

// ---------- Prospects ----------

export const PROSPECT_SOURCES = ['WEBSITE', 'PHONE', 'WALK_IN', 'REFERRAL', 'SOCIAL_MEDIA', 'OTHER']
export const PROSPECT_STATUSES = ['NEW', 'CONTACTED', 'INTERESTED', 'NOT_INTERESTED', 'CONVERTED']

// A prospect is an Admission in the PROSPECT stage. The page's lead `status`
// and `source` have no columns, so they are kept in the documents JSON; the
// pipeline stage is exposed separately as `admissionStatus`.
export function prospectToClient(admission: Admission) {
  const meta = getMeta(admission)
  return {
    ...withAliases(admission),
    admissionStatus: admission.status,
    status: typeof meta.prospectStatus === 'string' ? meta.prospectStatus : 'NEW',
    source: typeof meta.source === 'string' ? meta.source : 'OTHER',
  }
}

// ---------- Applications ----------

// Statuses the applications page knows, derived from the pipeline stage.
// "Under review" has no stage of its own, so it is flagged in the documents JSON.
export function applicationStatus(admission: Admission) {
  switch (admission.status) {
    case 'APPROVED':
    case 'ADMITTED':
      return 'APPROVED'
    case 'REJECTED':
      return 'REJECTED'
    case 'WAITLISTED':
      return 'WAITLISTED'
    case 'TEST_SCHEDULED':
    case 'TEST_COMPLETED':
    case 'INTERVIEW_SCHEDULED':
      return 'UNDER_REVIEW'
    default:
      return getMeta(admission).underReview === true ? 'UNDER_REVIEW' : 'SUBMITTED'
  }
}

export function applicationToClient(admission: Admission) {
  return {
    ...withAliases(admission),
    admissionStatus: admission.status,
    status: applicationStatus(admission),
    approvedAt: admission.approvalDate ?? (admission.status === 'APPROVED' || admission.status === 'ADMITTED' ? admission.updatedAt : null),
    enrolled: admission.status === 'ADMITTED' || !!admission.studentId,
  }
}

// ---------- Interviews ----------

export const INTERVIEW_STATUSES = ['SCHEDULED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED']

export interface InterviewMeta {
  date?: string
  time?: string
  interviewer?: string
  venue?: string
  status?: string
  // true when the admission row was created by the interview form itself
  createdByInterview?: boolean
  previousStatus?: string
}

export function getInterviewMeta(admission: Admission): InterviewMeta {
  const interview = getMeta(admission).interview
  return interview && typeof interview === 'object' ? { ...(interview as InterviewMeta) } : {}
}

// Interviews are stored on the Admission row (interviewDate/interviewNotes)
// with the scheduling details in documents.interview.
export function interviewToClient(admission: Admission) {
  const interview = getInterviewMeta(admission)
  const iso = admission.interviewDate ? admission.interviewDate.toISOString() : null
  const date = interview.date || (iso ? iso.slice(0, 10) : '')
  const time = interview.time || (iso ? iso.slice(11, 16) : '')
  return {
    ...withAliases(admission),
    admissionStatus: admission.status,
    contactPhone: admission.parentPhone,
    // local "YYYY-MM-DDTHH:MM" so the page's date input and display agree
    interviewDate: date ? `${date}T${time || '00:00'}` : null,
    interviewTime: time,
    interviewer: interview.interviewer || '',
    venue: interview.venue || '',
    status: interview.status || 'SCHEDULED',
    notes: admission.interviewNotes || '',
  }
}
