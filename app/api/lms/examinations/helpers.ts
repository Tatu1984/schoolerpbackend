import prisma from '@/lib/prisma'
import { getSchoolFilter, AuthenticatedSession } from '@/lib/api-utils'

export const examInclude = {
  course: { select: { id: true, name: true, code: true, schoolId: true } },
  _count: { select: { results: true } },
}

// The Exam model has no passing-marks column. The dashboard form collects one,
// so it is kept as a tagged line inside `description`.
const PASSING_RE = /Passing marks:\s*(\d+(?:\.\d+)?)/i

export function readPassingMarks(description: string | null | undefined): number | null {
  const match = description ? PASSING_RE.exec(description) : null
  return match ? Number(match[1]) : null
}

export function writePassingMarks(description: string | null | undefined, passingMarks: number | null) {
  const rest = (description || '').replace(PASSING_RE, '').trim()
  const tag = passingMarks !== null ? `Passing marks: ${passingMarks}` : ''
  return [rest, tag].filter(Boolean).join('\n') || null
}

// Map Prisma field names to the names the dashboard page reads/sends.
export function examToClient<T extends {
  title: string
  examDate: Date
  maxScore: number
  description: string | null
}>(exam: T) {
  return {
    ...exam,
    examName: exam.title,
    date: exam.examDate.toISOString().slice(0, 10),
    totalMarks: exam.maxScore,
    passingMarks: readPassingMarks(exam.description),
  }
}

// Exams have no schoolId - scope through the parent course
export function findScopedExam(id: string, session: AuthenticatedSession | null) {
  const schoolFilter = getSchoolFilter(session)
  return prisma.exam.findFirst({
    where: {
      id,
      ...(schoolFilter.schoolId ? { course: { schoolId: schoolFilter.schoolId } } : {}),
    },
    include: examInclude,
  })
}

export interface ParsedExam {
  title?: string
  courseId?: string
  examDate?: Date
  duration?: number | null
  maxScore?: number
  passingMarks?: number | null
  description?: string | null
  isActive?: boolean
}

// Accepts both the page's names (examName/date/totalMarks) and the Prisma names.
// With `partial`, only fields present in the body are validated.
export function parseExamBody(body: Record<string, unknown>, partial: boolean) {
  const errors: Record<string, string[]> = {}
  const data: ParsedExam = {}

  const rawTitle = body.examName ?? body.title
  if (rawTitle !== undefined || !partial) {
    const title = typeof rawTitle === 'string' ? rawTitle.trim() : ''
    if (!title) errors.examName = ['Exam name is required']
    else data.title = title
  }

  if (body.courseId !== undefined || !partial) {
    if (typeof body.courseId !== 'string' || !body.courseId) errors.courseId = ['Course is required']
    else data.courseId = body.courseId
  }

  const rawDate = body.date ?? body.examDate
  if (rawDate !== undefined || !partial) {
    const examDate = rawDate ? new Date(rawDate as string) : null
    if (!examDate || isNaN(examDate.getTime())) errors.date = ['A valid exam date is required']
    else data.examDate = examDate
  }

  const rawScore = body.totalMarks ?? body.maxScore
  if (rawScore !== undefined || !partial) {
    const maxScore = Number(rawScore)
    if (rawScore === '' || rawScore === null || !Number.isFinite(maxScore) || maxScore <= 0) {
      errors.totalMarks = ['Total marks must be a positive number']
    } else data.maxScore = maxScore
  }

  if (body.duration !== undefined) {
    if (body.duration === '' || body.duration === null) data.duration = null
    else {
      const duration = Math.round(Number(body.duration))
      if (!Number.isFinite(duration) || duration <= 0) errors.duration = ['Duration must be a positive number']
      else data.duration = duration
    }
  }

  if (body.passingMarks !== undefined) {
    if (body.passingMarks === '' || body.passingMarks === null) data.passingMarks = null
    else {
      const passingMarks = Number(body.passingMarks)
      if (!Number.isFinite(passingMarks) || passingMarks < 0) errors.passingMarks = ['Passing marks cannot be negative']
      else data.passingMarks = passingMarks
    }
  }

  if (body.description !== undefined) {
    data.description = typeof body.description === 'string' ? body.description : null
  }
  if (typeof body.isActive === 'boolean') data.isActive = body.isActive

  if (
    data.passingMarks != null && data.maxScore !== undefined && data.passingMarks > data.maxScore
  ) {
    errors.passingMarks = ['Passing marks cannot exceed total marks']
  }

  return { data, errors: Object.keys(errors).length ? errors : null }
}
