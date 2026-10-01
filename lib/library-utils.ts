import type { Prisma } from '@prisma/client'
import { parseDate, parseNumber } from '@/lib/school-scope'

const optionalText = (v: unknown): string | null => {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s ? s : null
}

/**
 * Normalise a book form payload (strings from inputs, nulls for blanks) into
 * Book column values. Only keys present in the body are returned, so the same
 * function serves create and partial update.
 */
export function bookFieldsFromBody(body: Record<string, unknown>): {
  data: Omit<Prisma.BookUncheckedUpdateInput, 'libraryId'>
  error?: string
} {
  const data: Omit<Prisma.BookUncheckedUpdateInput, 'libraryId'> = {}

  if (body.title !== undefined) {
    const title = String(body.title ?? '').trim()
    if (!title) return { data, error: 'Title is required' }
    data.title = title
  }
  for (const key of ['author', 'isbn', 'barcode', 'category', 'publisher', 'edition', 'language', 'location', 'description', 'coverImage'] as const) {
    if (body[key] !== undefined) data[key] = optionalText(body[key])
  }
  if (body.pages !== undefined) {
    const pages = parseNumber(body.pages)
    data.pages = pages === null ? null : Math.round(pages)
  }
  if (body.price !== undefined) data.price = parseNumber(body.price)
  if (body.quantity !== undefined) {
    const quantity = parseNumber(body.quantity)
    if (quantity === null || quantity < 0) return { data, error: 'Quantity must be zero or more' }
    data.quantity = Math.round(quantity)
  }
  if (body.available !== undefined) {
    const available = parseNumber(body.available)
    if (available !== null) {
      if (available < 0) return { data, error: 'Available copies must be zero or more' }
      data.available = Math.round(available)
    }
  }
  if (body.purchaseDate !== undefined) {
    const d = parseDate(body.purchaseDate)
    if (d === undefined) return { data, error: 'Invalid purchase date' }
    data.purchaseDate = d
  }
  if (typeof body.isActive === 'boolean') data.isActive = body.isActive

  return { data }
}

/** Adds the aliases the circulation screens use (availableCopies / totalCopies). */
export function withCopyAliases<T extends { available: number; quantity: number }>(book: T) {
  return { ...book, availableCopies: book.available, totalCopies: book.quantity }
}
