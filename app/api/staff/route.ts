import { NextRequest } from 'next/server'
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
import { staffSchema } from '@/lib/validations'
import { resolveSchoolId } from '@/lib/school-scope'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'

// schoolId is taken from the session for school users; only SUPER_ADMIN may pass one
const staffCreateSchema = staffSchema.extend({ schoolId: z.string().optional().nullable() })
import { Prisma } from '@prisma/client'

export const GET = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const pagination = getPaginationParams(request)
    const searchParams = getSearchParams(request)
    const orderBy = getSortParams(request, ['createdAt', 'firstName', 'lastName', 'employeeId', 'joiningDate'])
    const schoolFilter = getSchoolFilter(session)

    // Build where clause
    const where: Prisma.StaffWhereInput = {
      ...schoolFilter,
      ...(searchParams.search && {
        OR: [
          { firstName: { contains: searchParams.search, mode: 'insensitive' } },
          { lastName: { contains: searchParams.search, mode: 'insensitive' } },
          { employeeId: { contains: searchParams.search, mode: 'insensitive' } },
          { email: { contains: searchParams.search, mode: 'insensitive' } },
        ],
      }),
      ...(searchParams.staffType && { staffType: searchParams.staffType as Prisma.EnumStaffTypeFilter }),
      ...(searchParams.department && { department: { contains: searchParams.department, mode: 'insensitive' } }),
      ...(searchParams.isActive !== undefined && { isActive: searchParams.isActive === 'true' }),
    }

    const [staff, total] = await Promise.all([
      prisma.staff.findMany({
        where,
        include: {
          school: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
        },
        orderBy,
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.staff.count({ where }),
    ])

    // Remove sensitive fields
    const sanitizedStaff = staff.map(({ salary, bankDetails, ...rest }: { salary: number | null; bankDetails: unknown; [key: string]: unknown }) => rest)

    return paginatedResponse(sanitizedStaff, total, pagination)
  },
  { requireAuth: true, module: 'staff' }
)

export const POST = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const { data, errors } = await validateBody(request, staffCreateSchema)

    if (errors) {
      return validationErrorResponse(errors)
    }

    if (!data) {
      return errorResponse('Invalid request body')
    }

    // Use session's school ID if not provided
    const schoolId = await resolveSchoolId(session, data.schoolId)
    if (!schoolId) {
      return errorResponse('School ID is required')
    }

    // Check if employee ID is unique within the school
    const existingStaff = await prisma.staff.findFirst({
      where: {
        schoolId,
        employeeId: data.employeeId,
      },
    })

    if (existingStaff) {
      return validationErrorResponse({
        employeeId: ['Employee ID already exists in this school'],
      })
    }

    if (!data.dateOfBirth || !data.joiningDate) {
      return validationErrorResponse({
        ...(!data.dateOfBirth && { dateOfBirth: ['Date of birth is required'] }),
        ...(!data.joiningDate && { joiningDate: ['Joining date is required'] }),
      })
    }

    // Forms send '' for "no branch"
    const branchId = data.branchId || null
    if (branchId) {
      const branch = await prisma.branch.findFirst({ where: { id: branchId, schoolId } })
      if (!branch) {
        return validationErrorResponse({ branchId: ['Invalid branch for this school'] })
      }
    }

    // Check if email is unique
    const emailExists = await prisma.staff.findFirst({
      where: {
        email: data.email.toLowerCase(),
      },
    })

    if (emailExists) {
      return validationErrorResponse({
        email: ['Email already exists'],
      })
    }

    const staff = await prisma.staff.create({
      data: {
        schoolId,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email.toLowerCase(),
        phone: data.phone,
        dateOfBirth: new Date(data.dateOfBirth),
        gender: data.gender,
        bloodGroup: data.bloodGroup,
        photo: data.photo,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        pincode: data.pincode || null,
        branchId,
        employeeId: data.employeeId,
        staffType: data.staffType,
        designation: data.designation,
        department: data.department,
        qualification: data.qualification,
        experience: data.experience,
        joiningDate: new Date(data.joiningDate),
        salary: data.salary,
        bankDetails: data.bankDetails as Prisma.InputJsonValue | undefined,
        documents: data.documents as Prisma.InputJsonValue | undefined,
        isActive: data.isActive,
      },
      include: {
        school: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
    })

    await logAudit(session, request, 'CREATE', 'Staff', staff.id, {
      employeeId: staff.employeeId,
      name: `${staff.firstName} ${staff.lastName}`,
    })

    // Remove sensitive fields from response
    const { salary, bankDetails, ...sanitizedStaff } = staff

    return successResponse(sanitizedStaff, 201)
  },
  { requireAuth: true, module: 'staff' }
)
