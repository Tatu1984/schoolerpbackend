import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  successResponse,
  errorResponse,
  validationErrorResponse,
  validateBody,
  getSchoolFilter,
  AuthenticatedSession,
} from '@/lib/api-utils'
import { z } from 'zod'

// Validation schema for bulk promotion
const bulkPromoteSchema = z.object({
  studentIds: z.array(z.string()).min(1, 'At least one student must be selected'),
  nextClassId: z.string().min(1, 'Next class is required'),
  nextSectionId: z.string().optional().nullable(),
})

export const POST = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    if (!session) {
      return errorResponse('Unauthorized', 401)
    }

    const { data, errors } = await validateBody(request, bulkPromoteSchema)

    if (errors) {
      return validationErrorResponse(errors)
    }

    if (!data) {
      return errorResponse('Invalid request body')
    }

    // Get school filter
    const schoolFilter = getSchoolFilter(session)

    // Verify the target class exists and belongs to user's school
    const targetClass = await prisma.class.findFirst({
      where: {
        id: data.nextClassId,
        ...schoolFilter,
      },
    })

    if (!targetClass) {
      return validationErrorResponse({
        nextClassId: ['Invalid class or you do not have access to this class'],
      })
    }

    // Verify target section if provided
    if (data.nextSectionId) {
      const targetSection = await prisma.section.findFirst({
        where: {
          id: data.nextSectionId,
          classId: data.nextClassId,
        },
      })

      if (!targetSection) {
        return validationErrorResponse({
          nextSectionId: ['Invalid section for the selected class'],
        })
      }
    }

    // Verify all students exist and belong to user's school
    const students = await prisma.student.findMany({
      where: {
        id: { in: data.studentIds },
        ...schoolFilter,
      },
    })

    if (students.length !== data.studentIds.length) {
      return validationErrorResponse({
        studentIds: ['Some students were not found or you do not have access to them'],
      })
    }

    // Update all selected students
    const result = await prisma.student.updateMany({
      where: {
        id: { in: data.studentIds },
        ...schoolFilter,
      },
      data: {
        classId: data.nextClassId,
        sectionId: data.nextSectionId,
      },
    })

    return successResponse({
      message: `Successfully promoted ${result.count} students`,
      count: result.count,
    })
  },
  { requireAuth: true, module: 'students' }
)
