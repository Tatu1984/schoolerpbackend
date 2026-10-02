import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  getSchoolFilter,
  successResponse,
  errorResponse,
  validationErrorResponse,
  notFoundResponse,
} from '@/lib/api-utils'
import { Prisma } from '@prisma/client'
import {
  courseInclude,
  courseToClient,
  resolveInstructor,
  instructorNotFoundMessage,
  parseOptionalDate,
  isUniqueViolation,
} from '../helpers'

export const GET = withApiHandler(
  async (_request: NextRequest, { params }, session) => {
    const course = await prisma.course.findFirst({
      where: { id: params.id, ...getSchoolFilter(session) },
      include: { ...courseInclude, assignments: true, exams: true },
    })

    if (!course) {
      return notFoundResponse('Course not found')
    }

    return successResponse(courseToClient(course))
  },
  { requireAuth: true, module: 'lms' }
)

export const PUT = withApiHandler(
  async (request: NextRequest, { params }, session) => {
    // Check if course exists and user has access
    const existing = await prisma.course.findFirst({
      where: { id: params.id, ...getSchoolFilter(session) },
      include: courseInclude,
    })
    if (!existing) {
      return notFoundResponse('Course not found')
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return errorResponse('Invalid request body')
    }

    // A course stays in its school; related records are validated against it
    const schoolId = existing.schoolId
    const errors: Record<string, string[]> = {}
    const data: Prisma.CourseUncheckedUpdateInput = {}

    if (body.name !== undefined) {
      const name = String(body.name).trim()
      if (!name) errors.name = ['Course name is required']
      data.name = name
    }
    if (body.code !== undefined) {
      const code = String(body.code).trim()
      if (!code) errors.code = ['Course code is required']
      data.code = code
    }
    if (body.description !== undefined) data.description = body.description || null
    if (typeof body.isActive === 'boolean') data.isActive = body.isActive

    if (body.startDate !== undefined) {
      const startDate = parseOptionalDate(body.startDate)
      if (startDate === 'invalid') errors.startDate = ['Invalid date']
      else data.startDate = startDate
    }
    if (body.endDate !== undefined) {
      const endDate = parseOptionalDate(body.endDate)
      if (endDate === 'invalid') errors.endDate = ['Invalid date']
      else data.endDate = endDate
    }

    if (body.classId !== undefined) {
      const classId: string | null = body.classId || null
      if (classId && !(await prisma.class.findFirst({ where: { id: classId, schoolId } }))) {
        errors.classId = ['Invalid class for this school']
      } else data.classId = classId
    }
    if (body.subjectId !== undefined) {
      const subjectId: string | null = body.subjectId || null
      if (subjectId && !(await prisma.subject.findFirst({ where: { id: subjectId, schoolId } }))) {
        errors.subjectId = ['Invalid subject for this school']
      } else data.subjectId = subjectId
    }

    if (body.teacherId !== undefined) {
      const teacherId: string | null = body.teacherId || null
      if (teacherId && !(await prisma.staff.findFirst({ where: { id: teacherId, schoolId } }))) {
        errors.teacherId = ['Invalid teacher for this school']
      } else data.teacherId = teacherId
    } else if (typeof body.instructor === 'string') {
      const current = courseToClient(existing).instructor
      if (body.instructor.trim() !== current) {
        // null clears the teacher; undefined means no (single) matching staff member
        const teacherId = await resolveInstructor(body.instructor, schoolId)
        if (teacherId !== undefined) data.teacherId = teacherId
        else errors.instructor = [instructorNotFoundMessage(body.instructor)]
      }
    }

    if (Object.keys(errors).length) {
      return validationErrorResponse(errors)
    }

    try {
      const course = await prisma.course.update({
        where: { id: params.id },
        data,
        include: courseInclude,
      })
      return successResponse(courseToClient(course))
    } catch (error) {
      if (isUniqueViolation(error)) {
        return errorResponse('A course with this code already exists in this school', 409)
      }
      throw error
    }
  },
  { requireAuth: true, module: 'lms' }
)

export const DELETE = withApiHandler(
  async (_request: NextRequest, { params }, session) => {
    // Check if course exists and user has access
    const existing = await prisma.course.findFirst({
      where: { id: params.id, ...getSchoolFilter(session) },
    })
    if (!existing) {
      return notFoundResponse('Course not found')
    }

    // Assignments and exams cascade; online classes are detached (see schema)
    await prisma.course.delete({ where: { id: params.id } })

    return successResponse({ message: 'Course deleted successfully' })
  },
  { requireAuth: true, module: 'lms' }
)
