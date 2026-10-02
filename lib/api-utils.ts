import { NextRequest, NextResponse } from 'next/server'
import { bearerToken, verifyAccessToken } from '@/lib/jwt'
import prisma from '@/lib/prisma'
import { ZodError, ZodSchema } from 'zod'
import { UserRole } from '@prisma/client'

// Session and auth types
export interface SessionUser {
  id: string
  email: string
  name: string
  role: UserRole
  schoolId?: string
  isActive: boolean
  mustChangePassword?: boolean
}

export interface AuthenticatedSession {
  user: SessionUser
  expires: string
}

// Response helpers
export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status })
}

export function errorResponse(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}

export function unauthorizedResponse(message = 'Unauthorized') {
  return NextResponse.json({ success: false, error: message }, { status: 401 })
}

export function forbiddenResponse(message = 'Forbidden') {
  return NextResponse.json({ success: false, error: message }, { status: 403 })
}

export function notFoundResponse(message = 'Not found') {
  return NextResponse.json({ success: false, error: message }, { status: 404 })
}

export function validationErrorResponse(errors: Record<string, string[]>) {
  return NextResponse.json({
    success: false,
    error: 'Validation failed',
    details: errors
  }, { status: 400 })
}

export function serverErrorResponse(message = 'Internal server error') {
  return NextResponse.json({ success: false, error: message }, { status: 500 })
}

// Authentication helper
// Authentication helper: every client (web frontend, mobile apps) sends
// `Authorization: Bearer <accessToken>` obtained from POST /api/auth/login.
// The user row is re-read on every request so that deactivating an account,
// changing a password or "sign out everywhere" takes effect immediately.
export async function requireAuth(request: NextRequest): Promise<AuthenticatedSession | null> {
  const token = bearerToken(request.headers.get('authorization'))
  const claims = token ? await verifyAccessToken(token) : null
  if (!claims) return null

  const user = await prisma.user.findUnique({
    where: { id: claims.id },
    select: { isActive: true, tokenVersion: true, mustChangePassword: true, role: true, schoolId: true },
  })
  if (!user || !user.isActive || user.tokenVersion !== claims.tokenVersion) return null

  return {
    user: {
      id: claims.id,
      email: claims.email,
      name: claims.name,
      role: user.role,
      schoolId: user.schoolId,
      isActive: true,
      mustChangePassword: user.mustChangePassword,
    },
    expires: '',
  }
}

// Endpoints a user may still call while a password change is pending
const passwordChangeExempt = /^\/api(\/v1)?\/(auth|account)(\/|$)/

// Role-based access control
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

export function hasRole(userRole: UserRole, requiredRoles: UserRole[]): boolean {
  return requiredRoles.includes(userRole)
}

export function hasMinimumRole(userRole: UserRole, minimumRole: UserRole): boolean {
  return roleHierarchy[userRole] >= roleHierarchy[minimumRole]
}

// Module-based permissions
const modulePermissions: Record<string, UserRole[]> = {
  students: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'HEAD_TEACHER', 'TEACHER', 'RECEPTIONIST'],
  staff: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL'],
  admissions: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'RECEPTIONIST'],
  finance: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT'],
  fees: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT'],
  library: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'LIBRARIAN'],
  transport: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TRANSPORT_MANAGER'],
  hostel: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'HOSTEL_WARDEN'],
  inventory: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT'],
  lms: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER'],
  communication: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'HEAD_TEACHER', 'TEACHER'],
  analytics: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL'],
  security: ['SUPER_ADMIN', 'SCHOOL_ADMIN'],
  settings: ['SUPER_ADMIN', 'SCHOOL_ADMIN'],
  canteen: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT'],
  marketplace: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT'],
  classes: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'HEAD_TEACHER'],
  sections: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'HEAD_TEACHER'],
  subjects: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'HEAD_TEACHER'],
  roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN'],
  // Schools module: All authenticated users can read their own school (for dropdowns/forms)
  // Creating/editing schools is controlled in the route handler itself
  schools: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'HEAD_TEACHER', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'TRANSPORT_MANAGER', 'HOSTEL_WARDEN', 'RECEPTIONIST'],
  branches: ['SUPER_ADMIN', 'SCHOOL_ADMIN'],
  'academic-years': ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL'],
}

export function hasModuleAccess(userRole: UserRole, module: string): boolean {
  const allowedRoles = modulePermissions[module]
  if (!allowedRoles) return userRole === 'SUPER_ADMIN'
  return allowedRoles.includes(userRole)
}

// Validation helper
export async function validateBody<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): Promise<{ data: T | null; errors: Record<string, string[]> | null }> {
  try {
    const body = await request.json()
    const data = schema.parse(body)
    return { data, errors: null }
  } catch (error) {
    if (error instanceof ZodError) {
      const errors: Record<string, string[]> = {}
      error.errors.forEach((err) => {
        const path = err.path.join('.')
        if (!errors[path]) errors[path] = []
        errors[path].push(err.message)
      })
      return { data: null, errors }
    }
    return { data: null, errors: { _error: ['Invalid JSON body'] } }
  }
}

// Pagination helper
export interface PaginationParams {
  page: number
  limit: number
  skip: number
}

export function getPaginationParams(request: NextRequest): PaginationParams {
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
  const skip = (page - 1) * limit
  return { page, limit, skip }
}

export function paginatedResponse<T>(
  data: T[],
  total: number,
  params: PaginationParams
) {
  const totalPages = Math.ceil(total / params.limit)
  return NextResponse.json({
    success: true,
    data,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages,
      hasMore: params.page < totalPages
    }
  })
}

// Search helper
export function getSearchParams(request: NextRequest): Record<string, string> {
  const { searchParams } = new URL(request.url)
  const params: Record<string, string> = {}
  searchParams.forEach((value, key) => {
    if (!['page', 'limit', 'sortBy', 'sortOrder'].includes(key)) {
      params[key] = value
    }
  })
  return params
}

// Sort helper
export function getSortParams(request: NextRequest, allowedFields: string[] = ['createdAt']) {
  const { searchParams } = new URL(request.url)
  const sortBy = searchParams.get('sortBy') || 'createdAt'
  const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc'

  if (!allowedFields.includes(sortBy)) {
    return { [allowedFields[0]]: sortOrder }
  }
  return { [sortBy]: sortOrder }
}

// API handler wrapper with auth and error handling
// Next.js 16+ uses Promise<params> for dynamic route parameters
type ApiHandler = (
  request: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => Promise<NextResponse>

interface ApiOptions {
  requireAuth?: boolean
  requiredRoles?: UserRole[]
  module?: string
}

export function withApiHandler(
  handler: (
    request: NextRequest,
    context: { params: Record<string, string> },
    session: AuthenticatedSession | null
  ) => Promise<NextResponse>,
  options: ApiOptions = {}
): ApiHandler {
  return async (request: NextRequest, context: { params: Promise<Record<string, string>> }) => {
    try {
      // Get session
      const session = await requireAuth(request)

      // Check authentication
      if (options.requireAuth !== false && !session) {
        return unauthorizedResponse()
      }

      // Auto-created and admin-reset accounts must choose their own password first
      if (session?.user.mustChangePassword && !passwordChangeExempt.test(request.nextUrl.pathname)) {
        return NextResponse.json(
          { success: false, error: 'Password change required', code: 'PASSWORD_CHANGE_REQUIRED' },
          { status: 403 }
        )
      }

      // Check role-based access
      if (session && options.requiredRoles?.length) {
        if (!hasRole(session.user.role, options.requiredRoles)) {
          return forbiddenResponse('Insufficient permissions')
        }
      }

      // Check module access
      if (session && options.module) {
        if (!hasModuleAccess(session.user.role, options.module)) {
          return forbiddenResponse(`No access to ${options.module} module (role: ${session.user.role})`)
        }
      }

      // Await params for Next.js 16+ compatibility
      const resolvedParams = await context.params

      // Call the actual handler with resolved params
      return await handler(request, { params: resolvedParams }, session)
    } catch (error) {
      console.error('API Error:', error)
      return serverErrorResponse(
        error instanceof Error ? error.message : 'An unexpected error occurred'
      )
    }
  }
}

// School-scoped query helper
export function getSchoolFilter(session: AuthenticatedSession | null) {
  if (!session) return {}
  if (session.user.role === 'SUPER_ADMIN') return {}
  // Never fall back to "no filter": a user without a school sees nothing
  return { schoolId: session.user.schoolId || '__no_school__' }
}
