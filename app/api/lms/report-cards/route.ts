import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  getSchoolFilter,
  successResponse,
  validationErrorResponse,
  validateBody
} from '@/lib/api-utils'
import { reportCardSchema } from '@/lib/validations'
import { Prisma } from '@prisma/client'

const include = {
  student: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      admissionNumber: true,
      rollNumber: true,
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
    },
  },
  academicYear: { select: { id: true, name: true } },
}

function gradeFor(percentage: number) {
  if (percentage >= 90) return 'A+'
  if (percentage >= 80) return 'A'
  if (percentage >= 70) return 'B+'
  if (percentage >= 60) return 'B'
  if (percentage >= 50) return 'C'
  if (percentage >= 40) return 'D'
  return 'F'
}

// Flatten to the shape the dashboard page renders (studentName, className, ...).
// `academicYear` becomes the year's name because the page prints it directly.
function toClient(card: Prisma.ReportCardGetPayload<{ include: typeof include }>) {
  const { student, academicYear, ...rest } = card
  const grades = (rest.grades && typeof rest.grades === 'object' && !Array.isArray(rest.grades)
    ? rest.grades
    : {}) as Record<string, unknown>
  const percentage = Math.round((rest.overallScore ?? 0) * 10) / 10
  const storedGrade = typeof grades.overallGrade === 'string' ? grades.overallGrade : null

  return {
    ...rest,
    student,
    studentName: `${student.firstName} ${student.lastName}`.trim(),
    admissionNumber: student.admissionNumber,
    className: student.class?.name ?? '',
    section: student.section?.name ?? '',
    academicYear: academicYear.name,
    percentage,
    overallGrade: storedGrade || (rest.overallScore === null ? 'N/A' : gradeFor(percentage)),
  }
}

export const GET = withApiHandler(
  async (request: NextRequest, { params }, session) => {
    const schoolFilter = getSchoolFilter(session)

    const reportCards = await prisma.reportCard.findMany({
      where: schoolFilter.schoolId ? {
        student: { schoolId: schoolFilter.schoolId }
      } : {},
      include,
      orderBy: { createdAt: 'desc' }
    })

    return successResponse(reportCards.map(toClient))
  },
  { requireAuth: true, module: 'lms' }
)

export const POST = withApiHandler(
  async (request: NextRequest, { params }, session) => {
    // Validate request body
    const { data, errors } = await validateBody(request, reportCardSchema)
    if (errors) {
      return validationErrorResponse(errors)
    }

    // Verify student exists and belongs to user's school
    const student = await prisma.student.findFirst({
      where: {
        id: data!.studentId,
        ...getSchoolFilter(session),
      }
    })

    if (!student) {
      return validationErrorResponse({ studentId: ['Student not found'] })
    }

    const reportCard = await prisma.reportCard.create({
      data: {
        studentId: data!.studentId,
        academicYearId: data!.academicYearId,
        term: data!.term,
        grades: data!.grades as Prisma.InputJsonValue,
        overallScore: data!.overallScore,
        remarks: data!.remarks,
        isPublished: data!.isPublished,
      },
      include,
    })

    return successResponse(toClient(reportCard), 201)
  },
  { requireAuth: true, module: 'lms' }
)
