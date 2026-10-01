import { NextRequest } from 'next/server'
import { ZodError, ZodSchema } from 'zod'
import { Prisma } from '@prisma/client'

/**
 * Helpers for routes that receive raw dashboard form state
 * (empty strings for blank inputs, numbers as strings, page-specific field names).
 */

export type FormBody = Record<string, unknown>

/** Read a JSON object body; anything else (invalid JSON, arrays) becomes {}. */
export async function readJson(request: NextRequest): Promise<FormBody> {
  try {
    const body = await request.json()
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as FormBody) : {}
  } catch {
    return {}
  }
}

/** Trimmed string, or null when the value is blank / not a string or number. */
export function str(value: unknown): string | null {
  if (typeof value === 'number') return String(value)
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/** Number from a form value. undefined when blank, NaN when unparseable (so zod rejects it). */
export function num(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined
  if (typeof value === 'number') return value
  return Number(value)
}

/** Run a zod schema and return errors in the same shape validateBody() uses. */
export function parseWith<T>(
  schema: ZodSchema<T>,
  input: unknown
): { data: T; errors: null } | { data: null; errors: Record<string, string[]> } {
  try {
    return { data: schema.parse(input), errors: null }
  } catch (error) {
    if (error instanceof ZodError) {
      const errors: Record<string, string[]> = {}
      error.errors.forEach((err) => {
        const path = err.path.join('.') || '_error'
        if (!errors[path]) errors[path] = []
        errors[path].push(err.message)
      })
      return { data: null, errors }
    }
    throw error
  }
}

/** Prisma error code (P2002 unique, P2003 foreign key, ...) or null. */
export function prismaErrorCode(error: unknown): string | null {
  return error instanceof Prisma.PrismaClientKnownRequestError ? error.code : null
}
