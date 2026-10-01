import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { hash } from 'bcryptjs'
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
  hasMinimumRole,
  AuthenticatedSession,
} from '@/lib/api-utils'
import { userSchema } from '@/lib/validations'
import { Prisma, UserRole } from '@prisma/client'

export const GET = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    // Only admins can list users
    if (!session || !hasMinimumRole(session.user.role, 'SCHOOL_ADMIN')) {
      return errorResponse('Only administrators can view user list', 403)
    }

    const pagination = getPaginationParams(request)
    const searchParams = getSearchParams(request)
    const orderBy = getSortParams(request, ['createdAt', 'firstName', 'lastName', 'email'])
    const schoolFilter = getSchoolFilter(session)

    const where: Prisma.UserWhereInput = {
      ...schoolFilter,
      ...(searchParams.search && {
        OR: [
          { firstName: { contains: searchParams.search, mode: 'insensitive' } },
          { lastName: { contains: searchParams.search, mode: 'insensitive' } },
          { email: { contains: searchParams.search, mode: 'insensitive' } },
        ],
      }),
      ...(searchParams.role && { role: searchParams.role as UserRole }),
      ...(searchParams.isActive !== undefined && { isActive: searchParams.isActive === 'true' }),
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          isActive: true,
          lastLogin: true,
          createdAt: true,
          school: { select: { id: true, name: true } },
          customRoles: {
            include: {
              role: { select: { id: true, name: true } },
            },
          },
        },
        orderBy,
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.user.count({ where }),
    ])

    return paginatedResponse(users, total, pagination)
  },
  { requireAuth: true, module: 'roles' }
)

export const POST = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    // Only admins can create users
    if (!session || !hasMinimumRole(session.user.role, 'SCHOOL_ADMIN')) {
      return errorResponse('Only administrators can create users', 403)
    }

    const { data, errors } = await validateBody(request, userSchema)

    if (errors) {
      return validationErrorResponse(errors)
    }

    if (!data) {
      return errorResponse('Invalid request body')
    }

    const schoolId = data.schoolId || session.user.schoolId
    if (!schoolId) {
      return errorResponse('School ID is required', 400)
    }

    // Check email uniqueness
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    })

    if (existingUser) {
      return validationErrorResponse({
        email: ['User with this email already exists'],
      })
    }

    // Prevent creating users with higher privileges
    const roleHierarchy: Record<UserRole, number> = {
      SUPER_ADMIN: 100,
      SCHOOL_ADMIN: 90,
      PRINCIPAL: 80,
      VICE_PRINCIPAL: 70,
      HEAD_TEACHER: 60,
      TEACHER: 50,
      ACCOUNTANT: 50,
      LIBRARIAN: 40,
      TRANSPORT_MANAGER: 40,
      HOSTEL_WARDEN: 40,
      RECEPTIONIST: 30,
      PARENT: 20,
      STUDENT: 10,
    }

    if (roleHierarchy[data.role] >= roleHierarchy[session.user.role]) {
      return errorResponse('Cannot create user with equal or higher privileges', 403)
    }

    // Hash password
    const hashedPassword = await hash(data.password, 12)

    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        role: data.role,
        schoolId,
        isActive: data.isActive ?? true,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        school: { select: { id: true, name: true } },
      },
    })

    return successResponse(user, 201)
  },
  { requireAuth: true, module: 'roles' }
)
