import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export const courseInclude = {
  school: { select: { id: true, name: true } },
  class: { select: { id: true, name: true, grade: true } },
  subject: { select: { id: true, name: true, code: true } },
  teacher: { select: { id: true, firstName: true, lastName: true } },
  _count: { select: { assignments: true, exams: true } },
}

// The dashboard page shows a free-text `instructor`; Prisma links a teacher (Staff).
export function courseToClient<T extends {
  teacher: { firstName: string; lastName: string } | null
}>(course: T) {
  return {
    ...course,
    instructor: course.teacher ? `${course.teacher.firstName} ${course.teacher.lastName}`.trim() : '',
  }
}

// Resolve the page's free-text instructor name to a staff member of the school.
// Returns undefined when nothing matches (there is no column to keep free text in).
export async function resolveInstructor(instructor: string, schoolId: string) {
  const name = instructor.trim().replace(/\s+/g, ' ')
  if (!name) return null
  const [first, ...rest] = name.split(' ')
  const last = rest.join(' ')

  const candidates = await prisma.staff.findMany({
    where: {
      schoolId,
      isActive: true,
      firstName: { equals: first, mode: 'insensitive' },
      ...(last ? { lastName: { equals: last, mode: 'insensitive' } } : {}),
    },
    select: { id: true },
    take: 2,
  })
  return candidates.length === 1 ? candidates[0].id : undefined
}

export function parseOptionalDate(value: unknown): Date | null | 'invalid' {
  if (value === undefined || value === null || value === '') return null
  const date = new Date(value as string)
  return isNaN(date.getTime()) ? 'invalid' : date
}

export function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}
