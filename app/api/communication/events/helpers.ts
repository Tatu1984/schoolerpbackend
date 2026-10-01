import { Event, Prisma } from '@prisma/client'
import { ENTRANCE_TEST_ORGANIZER } from '@/lib/entrance-tests'

export const EVENT_AUDIENCES = ['ALL', 'STUDENTS', 'PARENTS', 'STAFF', 'TEACHERS']

// Event has no audience column. A restricted audience is tagged in `organizer`
// as "AUDIENCE:<value>"; anything else there is a real organizer name.
const AUDIENCE_PREFIX = 'AUDIENCE:'

// Entrance test sessions share the events table (see lib/entrance-tests.ts)
// and must not show up as school events. `not` alone would also drop NULLs.
export const notEntranceTest: Prisma.EventWhereInput = {
  OR: [{ organizer: null }, { organizer: { not: ENTRANCE_TEST_ORGANIZER } }],
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function audienceOf(organizer: string | null) {
  const value = organizer?.startsWith(AUDIENCE_PREFIX) ? organizer.slice(AUDIENCE_PREFIX.length) : 'ALL'
  return EVENT_AUDIENCES.includes(value) ? value : 'ALL'
}

// Adds the fields the events page works with: eventTime, venue, targetAudience.
// eventDate goes out as the same wall-clock "YYYY-MM-DDTHH:MM" it was entered as.
export function eventToClient(event: Event) {
  const d = event.eventDate
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  return {
    ...event,
    eventDate: `${date}T${time}`,
    eventTime: time,
    venue: event.location || '',
    targetAudience: audienceOf(event.organizer),
    organizer: event.organizer?.startsWith(AUDIENCE_PREFIX) ? null : event.organizer,
  }
}

interface ParsedEvent {
  title?: string
  description?: string | null
  eventDate?: Date
  location?: string | null
  organizer?: string | null
  isPublic?: boolean
  isActive?: boolean
}

// Accepts the page's fields (eventTime, venue, targetAudience) as well as the
// model's (location, organizer). With `existing`, only supplied fields change.
export function parseEventBody(body: Record<string, unknown>, existing?: Event) {
  const errors: Record<string, string[]> = {}
  const data: ParsedEvent = {}

  if (body.title !== undefined || !existing) {
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (!title) errors.title = ['Title is required']
    else data.title = title
  }
  if (body.description !== undefined) {
    data.description = typeof body.description === 'string' && body.description.trim() ? body.description : null
  }

  if (body.eventDate !== undefined || body.eventTime !== undefined || !existing) {
    const current = existing ? eventToClient(existing) : null
    const raw = typeof body.eventDate === 'string' ? body.eventDate : ''
    let eventDate: Date | null = null
    if (/^\d{4}-\d{2}-\d{2}/.test(raw) || (!raw && current)) {
      // date and time arrive as separate inputs
      const date = raw ? raw.slice(0, 10) : current!.eventDate.slice(0, 10)
      const time =
        typeof body.eventTime === 'string' && body.eventTime
          ? body.eventTime.slice(0, 5)
          : raw.length > 10 && body.eventTime === undefined
            ? null
            : current?.eventTime || '00:00'
      eventDate = time === null ? new Date(raw) : new Date(`${date}T${time}`)
    } else if (raw) {
      eventDate = new Date(raw)
    }
    if (!eventDate || isNaN(eventDate.getTime())) errors.eventDate = ['A valid event date is required']
    else data.eventDate = eventDate
  }

  const location = body.venue ?? body.location
  if (location !== undefined) {
    data.location = typeof location === 'string' && location.trim() ? location.trim() : null
  }

  if (body.targetAudience !== undefined) {
    const audience = String(body.targetAudience)
    if (!EVENT_AUDIENCES.includes(audience)) errors.targetAudience = ['Invalid target audience']
    else if (audience !== 'ALL') {
      data.organizer = `${AUDIENCE_PREFIX}${audience}`
      data.isPublic = false
    } else {
      // back to everyone: drop an audience tag but keep a real organizer name
      if (!existing || existing.organizer?.startsWith(AUDIENCE_PREFIX)) data.organizer = null
      data.isPublic = true
    }
  } else if (body.organizer !== undefined) {
    const organizer = typeof body.organizer === 'string' ? body.organizer.trim() : ''
    if (organizer === ENTRANCE_TEST_ORGANIZER) errors.organizer = ['Reserved organizer name']
    else data.organizer = organizer || null
  }

  if (typeof body.isPublic === 'boolean' && body.targetAudience === undefined) data.isPublic = body.isPublic
  if (typeof body.isActive === 'boolean') data.isActive = body.isActive

  return { data, errors: Object.keys(errors).length ? errors : null }
}
