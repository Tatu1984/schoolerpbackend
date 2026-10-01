import { Event } from '@prisma/client'

// Entrance test sessions (admissions > tests) have no model of their own. They
// are stored as Event rows tagged with this organizer value, with the
// test-specific details serialised into `description`. The communication events
// API filters these rows out so they only appear on the admissions page.
export const ENTRANCE_TEST_ORGANIZER = 'ENTRANCE_TEST'

export interface EntranceTestDetails {
  testDate: string // YYYY-MM-DD as entered
  testTime: string // HH:MM as entered
  duration: number
  maxSeats: number
  classLevel: string
  syllabus: string
  instructions: string
}

export function readEntranceTestDetails(event: Event): EntranceTestDetails {
  let stored: Partial<EntranceTestDetails> = {}
  try {
    const parsed = event.description ? JSON.parse(event.description) : null
    if (parsed && typeof parsed === 'object') stored = parsed
  } catch {
    // description was not written by this module - fall back to defaults
  }
  const iso = event.eventDate.toISOString()
  return {
    testDate: stored.testDate || iso.slice(0, 10),
    testTime: stored.testTime || iso.slice(11, 16),
    duration: Number(stored.duration) || 60,
    maxSeats: Number(stored.maxSeats) || 50,
    classLevel: stored.classLevel || '',
    syllabus: stored.syllabus || '',
    instructions: stored.instructions || '',
  }
}

// Shape the admissions tests page renders and edits.
export function entranceTestToClient(event: Event) {
  const details = readEntranceTestDetails(event)
  return {
    id: event.id,
    schoolId: event.schoolId,
    testName: event.title,
    venue: event.location || '',
    isActive: event.isActive,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
    ...details,
    // local "YYYY-MM-DDTHH:MM" so the page's date input and display agree
    testDate: `${details.testDate}T${details.testTime || '00:00'}`,
  }
}
