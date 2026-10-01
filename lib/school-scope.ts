import prisma from '@/lib/prisma'
import type { AuthenticatedSession } from '@/lib/api-utils'

/**
 * Read filter for models that carry a schoolId.
 * SUPER_ADMIN sees everything; everyone else is pinned to their own school.
 * A non-super-admin without a schoolId matches nothing (never "all schools").
 */
export function schoolWhere(session: AuthenticatedSession | null): { schoolId?: string } {
  if (session?.user.role === 'SUPER_ADMIN') return {}
  return { schoolId: session?.user.schoolId || '__no_school__' }
}

/**
 * School id to stamp on newly created records.
 * Non-super-admins always get their own school (the request body is ignored).
 * SUPER_ADMIN may target a school explicitly, else their own, else the first school.
 */
export async function resolveSchoolId(
  session: AuthenticatedSession | null,
  requested?: unknown
): Promise<string | null> {
  if (!session) return null
  if (session.user.role !== 'SUPER_ADMIN') return session.user.schoolId || null
  if (typeof requested === 'string' && requested) {
    const school = await prisma.school.findUnique({ where: { id: requested }, select: { id: true } })
    if (school) return school.id
  }
  if (session.user.schoolId) return session.user.schoolId
  const first = await prisma.school.findFirst({ select: { id: true }, orderBy: { createdAt: 'asc' } })
  return first?.id ?? null
}

/** Parse a date-ish value; returns null when empty, undefined when invalid. */
export function parseDate(value: unknown): Date | null | undefined {
  if (value === null || value === undefined || value === '') return null
  const d = new Date(value as string)
  return isNaN(d.getTime()) ? undefined : d
}

/** Parse a number-ish value (forms send strings); returns null when empty/invalid. */
export function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return isNaN(n) ? null : n
}
