import { EntranceTestDetails } from '@/lib/entrance-tests'

export interface ParsedTest {
  title?: string
  location?: string
  details: Partial<EntranceTestDetails>
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

// With `partial`, only fields present in the body are validated.
export function parseTestBody(body: Record<string, unknown>, partial: boolean) {
  const errors: Record<string, string[]> = {}
  const parsed: ParsedTest = { details: {} }

  if (body.testName !== undefined || !partial) {
    if (!text(body.testName)) errors.testName = ['Test name is required']
    else parsed.title = text(body.testName)
  }
  if (body.venue !== undefined) parsed.location = text(body.venue)

  if (body.testDate !== undefined || !partial) {
    const testDate = text(body.testDate).split('T')[0]
    if (!/^\d{4}-\d{2}-\d{2}$/.test(testDate) || isNaN(new Date(testDate).getTime())) {
      errors.testDate = ['A valid test date is required']
    } else parsed.details.testDate = testDate
  }
  if (body.testTime !== undefined) {
    const testTime = text(body.testTime)
    if (testTime && !/^\d{2}:\d{2}/.test(testTime)) errors.testTime = ['Invalid test time']
    else parsed.details.testTime = testTime.slice(0, 5)
  }

  for (const key of ['duration', 'maxSeats'] as const) {
    if (body[key] !== undefined) {
      const value = Math.round(Number(body[key]))
      if (!Number.isFinite(value) || value <= 0) {
        errors[key] = [`${key === 'duration' ? 'Duration' : 'Max seats'} must be a positive number`]
      } else parsed.details[key] = value
    }
  }

  if (body.classLevel !== undefined) parsed.details.classLevel = text(body.classLevel)
  if (body.syllabus !== undefined) parsed.details.syllabus = text(body.syllabus)
  if (body.instructions !== undefined) parsed.details.instructions = text(body.instructions)

  return { parsed, errors: Object.keys(errors).length ? errors : null }
}

export function toEventDate(details: { testDate: string; testTime?: string }) {
  return new Date(`${details.testDate}T${details.testTime || '00:00'}`)
}
