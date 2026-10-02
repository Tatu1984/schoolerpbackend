import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { ensureStudentUser, ensureGuardianUser } from '@/lib/accounts'
import {
  withApiHandler,
  successResponse,
  errorResponse,
  AuthenticatedSession,
} from '@/lib/api-utils'

interface BulkUploadResponse {
  success: boolean
  message: string
  created: number
  errors: string[]
  total: number
}

interface CSVRow {
  [key: string]: string
}

/** Split CSV text into rows of fields. Handles quoted fields ("12, Main St"), "" escapes and CRLF. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const input = text.replace(/^\uFEFF/, '')

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"' && field.trim() === '') {
      field = ''
      quoted = true
    } else if (ch === ',') {
      row.push(field.trim())
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i++
      row.push(field.trim())
      rows.push(row)
      row = []
      field = ''
    } else {
      field += ch
    }
  }
  row.push(field.trim())
  rows.push(row)

  return rows.filter((r) => r.some((value) => value !== ''))
}

/** Accepts YYYY-MM-DD (the template format) and DD/MM/YYYY or DD-MM-YYYY. */
function parseCsvDate(value: string): Date | null {
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value)
  let parts: [number, number, number] | null = null
  if (match) {
    parts = [Number(match[1]), Number(match[2]), Number(match[3])]
  } else {
    match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(value)
    if (match) parts = [Number(match[3]), Number(match[2]), Number(match[1])]
  }
  if (!parts) return null
  const [year, month, day] = parts
  const date = new Date(Date.UTC(year, month - 1, day))
  const valid =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  return valid ? date : null
}

export const POST = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    if (!session) {
      return errorResponse('Unauthorized', 401)
    }

    try {
      const formData = await request.formData()
      const file = formData.get('file') as File | null

      if (!file) {
        return errorResponse('File is required', 400)
      }

      // Read CSV content
      const text = await file.text()
      const lines = parseCsv(text)

      if (lines.length < 2) {
        return errorResponse('No data rows found in CSV file', 400)
      }

      const headers = lines[0]
      const errors: string[] = []
      let created = 0

      let school
      if (session.user.role === 'SUPER_ADMIN') {
        // For super admin, get first school (or require schoolId in request)
        school = await prisma.school.findFirst()
      } else {
        // For other users, use their school
        school = await prisma.school.findUnique({
          where: { id: session.user.schoolId }
        })
      }

      if (!school) {
        return errorResponse('School not found. Please ensure a school is set up.', 400)
      }

      // Process each row
      for (let i = 1; i < lines.length; i++) {
        try {
          const values = lines[i]
          const row: CSVRow = {}
          headers.forEach((header, index) => {
            row[header] = values[index] || ''
          })

          // Validate required fields
          if (!row.admissionNumber || !row.firstName || !row.lastName) {
            errors.push(`Row ${i + 1}: Missing required fields (admissionNumber, firstName, lastName)`)
            continue
          }

          // Check if admission number already exists
          const existingStudent = await prisma.student.findFirst({
            where: {
              schoolId: school.id,
              admissionNumber: row.admissionNumber
            }
          })

          if (existingStudent) {
            errors.push(`Row ${i + 1}: Admission number ${row.admissionNumber} already exists`)
            continue
          }

          // Find class
          const classRecord = await prisma.class.findFirst({
            where: {
              schoolId: school.id,
              name: row.className
            }
          })

          if (!classRecord) {
            errors.push(`Row ${i + 1}: Class ${row.className || '(blank)'} not found`)
            continue
          }

          const dateOfBirth = parseCsvDate(row.dateOfBirth)
          if (!dateOfBirth) {
            errors.push(
              row.dateOfBirth
                ? `Row ${i + 1}: Invalid dateOfBirth "${row.dateOfBirth}" (use YYYY-MM-DD)`
                : `Row ${i + 1}: dateOfBirth is required (YYYY-MM-DD)`
            )
            continue
          }

          // Find section
          let section = null
          if (row.sectionName) {
            section = await prisma.section.findFirst({
              where: {
                classId: classRecord.id,
                name: row.sectionName
              }
            })
            if (!section) {
              errors.push(`Row ${i + 1}: Section ${row.sectionName} not found in ${classRecord.name}`)
              continue
            }
          }

          // Validate gender
          const gender = row.gender && ['MALE', 'FEMALE', 'OTHER'].includes(row.gender.toUpperCase())
            ? row.gender.toUpperCase() as 'MALE' | 'FEMALE' | 'OTHER'
            : 'MALE'

          // Validate blood group
          const validBloodGroups = ['A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE']
          const bloodGroup = row.bloodGroup && validBloodGroups.includes(row.bloodGroup.toUpperCase().replace('+', '_POSITIVE').replace('-', '_NEGATIVE'))
            ? row.bloodGroup.toUpperCase().replace('+', '_POSITIVE').replace('-', '_NEGATIVE') as any
            : null

          // Create student
          const student = await prisma.student.create({
            data: {
              schoolId: school.id,
              classId: classRecord.id,
              sectionId: section?.id,
              admissionNumber: row.admissionNumber,
              firstName: row.firstName,
              lastName: row.lastName,
              dateOfBirth,
              gender,
              bloodGroup,
              phone: row.phone || null,
              email: row.email || null,
              address: row.address || null,
              city: row.city || null,
              state: row.state || null,
              pincode: row.pincode || null,
              nationality: row.nationality || null,
              religion: row.religion || null,
              admissionDate: new Date(),
              guardians: {
                create: row.guardianFirstName ? [{
                  firstName: row.guardianFirstName,
                  lastName: row.guardianLastName || '',
                  relation: row.guardianRelation || 'Parent',
                  phone: row.guardianPhone || '',
                  email: row.guardianEmail || null,
                  isPrimary: true
                }] : []
              }
            },
            include: { guardians: { select: { id: true } } }
          })

          created++

          // Same portal logins a single admission creates (student + parent)
          try {
            for (const guardian of student.guardians) {
              await ensureGuardianUser(guardian.id)
            }
            await ensureStudentUser(student.id)
          } catch (accountError) {
            console.error('Bulk upload: portal login not created for', row.admissionNumber, accountError)
            errors.push(`Row ${i + 1}: Student created, but the portal login could not be set up`)
          }
        } catch (error) {
          console.error('Bulk upload row failed:', error)
          const code = (error as { code?: string } | null)?.code
          errors.push(
            code === 'P2002'
              ? `Row ${i + 1}: Admission number already exists`
              : `Row ${i + 1}: Could not be saved - check the values in this row`
          )
        }
      }

      const response: BulkUploadResponse = {
        success: created > 0,
        message: created > 0
          ? `Successfully uploaded ${created} students`
          : 'No students were uploaded',
        created,
        errors,
        total: lines.length - 1
      }

      return successResponse(response)

    } catch (error) {
      console.error('Error in bulk upload:', error)
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
      return errorResponse(errorMessage, 500)
    }
  },
  { requireAuth: true, module: 'students' }
)
