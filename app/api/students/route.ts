import { NextRequest } from 'next/server'
import { z } from 'zod'
import { ensureStudentUser, ensureGuardianUser } from '@/lib/accounts'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  successResponse,
  errorResponse,
  validationErrorResponse,
  validateBody,
  getPaginationParams,
  paginatedResponse,
  getSearchParams,
  getSortParams,
  getSchoolFilter,
  AuthenticatedSession,
} from '@/lib/api-utils'
import { studentSchema } from '@/lib/validations'
import { Prisma } from '@prisma/client'

export const GET = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const pagination = getPaginationParams(request)
    const searchParams = getSearchParams(request)
    const orderBy = getSortParams(request, ['createdAt', 'firstName', 'lastName', 'admissionNumber'])
    const schoolFilter = getSchoolFilter(session)

    // Build where clause
    const where: Prisma.StudentWhereInput = {
      ...schoolFilter,
      ...(searchParams.search && {
        OR: [
          { firstName: { contains: searchParams.search, mode: 'insensitive' } },
          { lastName: { contains: searchParams.search, mode: 'insensitive' } },
          { admissionNumber: { contains: searchParams.search, mode: 'insensitive' } },
          { email: { contains: searchParams.search, mode: 'insensitive' } },
        ],
      }),
      ...(searchParams.classId && { classId: searchParams.classId }),
      ...(searchParams.sectionId && { sectionId: searchParams.sectionId }),
      ...(searchParams.isActive !== undefined && { isActive: searchParams.isActive === 'true' }),
    }

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        include: {
          school: { select: { id: true, name: true } },
          class: {
            select: {
              id: true,
              name: true,
              grade: true,
              academicYear: { select: { id: true, name: true } },
            },
          },
          section: { select: { id: true, name: true } },
          guardians: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              relation: true,
              phone: true,
              isPrimary: true,
            },
          },
        },
        orderBy,
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.student.count({ where }),
    ])

    return paginatedResponse(students, total, pagination)
  },
  { requireAuth: true, module: 'students' }
)

const createStudentSchema = studentSchema.extend({
  schoolId: z.string().optional(),
  guardians: z
    .array(
      z.object({
        relation: z.string().optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional().nullable(),
        occupation: z.string().optional().nullable(),
        address: z.string().optional().nullable(),
        isPrimary: z.boolean().optional(),
      })
    )
    .optional(),
})

export const POST = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    // The admission form posts untouched optional fields as '' - treat those as not provided
    const raw = await request.json().catch(() => null)
    if (!raw || typeof raw !== 'object') {
      return errorResponse('Invalid request body')
    }
    const cleaned = Object.fromEntries(Object.entries(raw).filter(([, value]) => value !== ''))
    const parsed = createStudentSchema.safeParse(cleaned)
    const data = parsed.success ? parsed.data : null
    const errors = parsed.success ? null : (parsed.error.flatten().fieldErrors as Record<string, string[]>)

    if (errors) {
      return validationErrorResponse(errors)
    }

    if (!data) {
      return errorResponse('Invalid request body')
    }

    // Use session's school ID if not provided (and not super admin)
    const schoolId = data.schoolId || session?.user.schoolId
    if (!schoolId) {
      return errorResponse('School ID is required')
    }

    // Check if admission number is unique within the school
    const existingStudent = await prisma.student.findFirst({
      where: {
        schoolId,
        admissionNumber: data.admissionNumber,
      },
    })

    if (existingStudent) {
      return validationErrorResponse({
        admissionNumber: ['Admission number already exists in this school'],
      })
    }

    // Verify the class belongs to the school
    const classExists = await prisma.class.findFirst({
      where: {
        id: data.classId,
        schoolId,
      },
    })

    if (!classExists) {
      return validationErrorResponse({
        classId: ['Invalid class for this school'],
      })
    }

    const student = await prisma.student.create({
      data: {
        schoolId,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        dateOfBirth: new Date(data.dateOfBirth),
        gender: data.gender,
        bloodGroup: data.bloodGroup,
        nationality: data.nationality,
        religion: data.religion,
        address: data.address,
        branchId: data.branchId,
        classId: data.classId,
        sectionId: data.sectionId,
        rollNumber: data.rollNumber,
        admissionNumber: data.admissionNumber,
        admissionDate: data.admissionDate ? new Date(data.admissionDate) : new Date(),
        previousSchool: data.previousSchool,
        medicalInfo: data.medicalInfo as Prisma.InputJsonValue | undefined,
        documents: data.documents as Prisma.InputJsonValue | undefined,
        customFields: data.customFields as Prisma.InputJsonValue | undefined,
        photo: data.photo,
        isActive: data.isActive,
      },
      include: {
        school: { select: { id: true, name: true } },
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
        guardians: true,
      },
    })

    // Guardians entered on the admission form
    for (const g of data.guardians || []) {
      if (!g.firstName || !g.phone) continue
      const guardian = await prisma.guardian.create({
        data: {
          studentId: student.id,
          relation: g.relation || 'Guardian',
          firstName: g.firstName,
          lastName: g.lastName || '',
          phone: g.phone,
          email: g.email || null,
          occupation: g.occupation || null,
          address: g.address || null,
          isPrimary: g.isPrimary ?? true,
        },
      })
      await ensureGuardianUser(guardian.id)
    }

    // Portal login for the student
    const portalLogin = await ensureStudentUser(student.id)

    return successResponse({ ...student, portalLogin }, 201)
  },
  { requireAuth: true, module: 'students' }
)
