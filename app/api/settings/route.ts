import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  successResponse,
  errorResponse,
  validateBody,
  validationErrorResponse,
  AuthenticatedSession,
} from '@/lib/api-utils'
import { logAudit } from '@/lib/audit'
import { Prisma } from '@prisma/client'
import { z } from 'zod'

/**
 * Settings are assembled from existing tables (there is no Settings model):
 *  - school profile        -> School (name, email, phone, address)
 *  - academic year dates   -> the school's current AcademicYear
 *  - notification/regional -> one reserved ComplianceRecord row per school
 *                             (complianceType SYSTEM_SETTINGS, values in `documents`)
 */
const SETTINGS_RECORD_TYPE = 'SYSTEM_SETTINGS'

const preferenceDefaults = {
  enableEmailNotifications: true,
  enableSMSNotifications: false,
  enablePushNotifications: true,
  defaultLanguage: 'en',
  dateFormat: 'DD/MM/YYYY',
  currency: 'INR',
  timezone: 'Asia/Kolkata',
}

type Preferences = typeof preferenceDefaults

const optionalDate = z
  .string()
  .refine((val) => !val || !isNaN(Date.parse(val)), 'Invalid date')
  .optional()
  .nullable()

const settingsSchema = z.object({
  schoolName: z.string().max(200).optional(),
  schoolEmail: z.string().email('Invalid email address').optional().or(z.literal('')),
  schoolPhone: z.string().optional(),
  schoolAddress: z.string().optional(),
  academicYearStart: optionalDate,
  academicYearEnd: optionalDate,
  enableEmailNotifications: z.boolean().optional(),
  enableSMSNotifications: z.boolean().optional(),
  enablePushNotifications: z.boolean().optional(),
  defaultLanguage: z.string().optional(),
  dateFormat: z.string().optional(),
  currency: z.string().optional(),
  timezone: z.string().optional(),
})

const toDateInput = (d?: Date | null) => (d ? d.toISOString().split('T')[0] : '')

function readPreferences(documents: Prisma.JsonValue | null | undefined): Preferences {
  const stored =
    documents && typeof documents === 'object' && !Array.isArray(documents)
      ? (documents as Record<string, unknown>)
      : {}
  const prefs: Record<string, unknown> = { ...preferenceDefaults }
  for (const key of Object.keys(preferenceDefaults) as (keyof Preferences)[]) {
    if (typeof stored[key] === typeof preferenceDefaults[key]) prefs[key] = stored[key]
  }
  return prefs as Preferences
}

async function loadSettings(schoolId: string) {
  const [school, currentYear, record] = await Promise.all([
    prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true, email: true, phone: true, address: true },
    }),
    prisma.academicYear.findFirst({
      where: { schoolId },
      orderBy: [{ isCurrent: 'desc' }, { startDate: 'desc' }],
    }),
    prisma.complianceRecord.findFirst({
      where: { schoolId, complianceType: SETTINGS_RECORD_TYPE },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  return {
    schoolName: school?.name || '',
    schoolEmail: school?.email || '',
    schoolPhone: school?.phone || '',
    schoolAddress: school?.address || '',
    academicYearStart: toDateInput(currentYear?.startDate),
    academicYearEnd: toDateInput(currentYear?.endDate),
    ...readPreferences(record?.documents),
  }
}

// GET /api/settings - Get settings for the signed-in user's school
export const GET = withApiHandler(
  async (_request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const schoolId = session?.user.schoolId
    if (!schoolId) {
      return errorResponse('No school is associated with this account')
    }

    return successResponse(await loadSettings(schoolId))
  },
  { requireAuth: true, module: 'settings' }
)

// PUT /api/settings - Update settings for the signed-in user's school
export const PUT = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const { data, errors } = await validateBody(request, settingsSchema)

    if (errors) {
      return validationErrorResponse(errors)
    }
    if (!data) {
      return errorResponse('Invalid request body')
    }

    const schoolId = session?.user.schoolId
    if (!schoolId) {
      return errorResponse('No school is associated with this account')
    }

    const school = await prisma.school.findUnique({ where: { id: schoolId } })
    if (!school) {
      return errorResponse('School not found', 404)
    }

    if (data.schoolName !== undefined && !data.schoolName.trim()) {
      return validationErrorResponse({ schoolName: ['School name is required'] })
    }
    if (data.schoolPhone && !/^[\d\s\-+()]+$/.test(data.schoolPhone)) {
      return validationErrorResponse({ schoolPhone: ['Invalid phone number'] })
    }

    const start = data.academicYearStart ? new Date(data.academicYearStart) : null
    const end = data.academicYearEnd ? new Date(data.academicYearEnd) : null
    if (start && end && end <= start) {
      return validationErrorResponse({ academicYearEnd: ['End date must be after start date'] })
    }

    await prisma.$transaction(async (tx) => {
      // 1. School profile
      await tx.school.update({
        where: { id: schoolId },
        data: {
          ...(data.schoolName !== undefined && { name: data.schoolName.trim() }),
          ...(data.schoolEmail !== undefined && {
            email: data.schoolEmail ? data.schoolEmail.toLowerCase() : null,
          }),
          ...(data.schoolPhone !== undefined && { phone: data.schoolPhone || null }),
          ...(data.schoolAddress !== undefined && { address: data.schoolAddress || null }),
        },
      })

      // 2. Academic year dates (same year GET reads from)
      if (start || end) {
        const currentYear = await tx.academicYear.findFirst({
          where: { schoolId },
          orderBy: [{ isCurrent: 'desc' }, { startDate: 'desc' }],
        })

        if (currentYear) {
          await tx.academicYear.update({
            where: { id: currentYear.id },
            data: { ...(start && { startDate: start }), ...(end && { endDate: end }) },
          })
        } else if (start && end) {
          await tx.academicYear.create({
            data: {
              schoolId,
              name: `${start.getUTCFullYear()}-${end.getUTCFullYear()}`,
              startDate: start,
              endDate: end,
              isCurrent: true,
            },
          })
        }
      }

      // 3. Notification + regional preferences
      const record = await tx.complianceRecord.findFirst({
        where: { schoolId, complianceType: SETTINGS_RECORD_TYPE },
        orderBy: { createdAt: 'asc' },
      })
      const prefs: Record<string, unknown> = { ...readPreferences(record?.documents) }
      for (const key of Object.keys(preferenceDefaults) as (keyof Preferences)[]) {
        if (data[key] !== undefined) prefs[key] = data[key]
      }

      if (record) {
        await tx.complianceRecord.update({
          where: { id: record.id },
          data: { documents: prefs as Prisma.InputJsonValue },
        })
      } else {
        await tx.complianceRecord.create({
          data: {
            schoolId,
            complianceType: SETTINGS_RECORD_TYPE,
            description: 'System settings (notification and regional preferences)',
            status: 'ACTIVE',
            validFrom: new Date(),
            documents: prefs as Prisma.InputJsonValue,
          },
        })
      }
    })

    await logAudit(session, request, 'UPDATE', 'Settings', schoolId, data)

    return successResponse(await loadSettings(schoolId))
  },
  { requireAuth: true, module: 'settings' }
)
