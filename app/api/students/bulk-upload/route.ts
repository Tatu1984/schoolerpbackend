import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  successResponse,
  errorResponse,
  getSchoolFilter,
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
      const lines = text.split('\n').filter(line => line.trim())

      if (lines.length < 2) {
        return errorResponse('No data rows found in CSV file', 400)
      }

      const headers = lines[0].split(',').map(h => h.trim())
      const errors: string[] = []
      let created = 0

      // Get school filter based on user role
      const schoolFilter = getSchoolFilter(session)

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

      // Get current academic year
      const academicYear = await prisma.academicYear.findFirst({
        where: { schoolId: school.id, isCurrent: true }
      })

      // Process each row
      for (let i = 1; i < lines.length; i++) {
        try {
          const values = lines[i].split(',').map(v => v.trim())
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
            errors.push(`Row ${i + 1}: Class ${row.className} not found`)
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
          await prisma.student.create({
            data: {
              schoolId: school.id,
              classId: classRecord.id,
              sectionId: section?.id,
              admissionNumber: row.admissionNumber,
              firstName: row.firstName,
              lastName: row.lastName,
              dateOfBirth: row.dateOfBirth ? new Date(row.dateOfBirth) : new Date(),
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
            }
          })

          created++
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          errors.push(`Row ${i + 1}: ${errorMessage}`)
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
