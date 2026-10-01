import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  successResponse,
  hasMinimumRole,
  errorResponse,
  AuthenticatedSession
} from '@/lib/api-utils'
import { logAudit } from '@/lib/audit'
import { ComplianceRecord, Prisma } from '@prisma/client'

/**
 * Both lists on the compliance page are stored as ComplianceRecord rows:
 *  - complianceType GDPR            -> checklist item; status COMPLIANT | PENDING,
 *                                      documents = { title, priority }
 *  - complianceType DATA_RETENTION  -> retention policy,
 *                                      documents = { dataType, retentionPeriod, purpose }
 */
const GDPR = 'GDPR'
const RETENTION = 'DATA_RETENTION'

const defaultChecklist = [
  { title: 'Privacy policy published', description: 'A current privacy policy is available to parents, students and staff.', priority: 'HIGH' },
  { title: 'Lawful basis documented', description: 'The lawful basis for processing each category of personal data is recorded.', priority: 'HIGH' },
  { title: 'Parental consent collected', description: 'Consent is obtained from guardians before processing data of minors.', priority: 'HIGH' },
  { title: 'Data protection officer appointed', description: 'A named person is responsible for data protection queries and requests.', priority: 'MEDIUM' },
  { title: 'Access controls reviewed', description: 'Role-based access to student and staff records is reviewed every term.', priority: 'HIGH' },
  { title: 'Data breach procedure in place', description: 'A documented procedure exists to detect, report and investigate data breaches.', priority: 'HIGH' },
  { title: 'Subject access request process', description: 'Requests to view, correct or delete personal data are handled within 30 days.', priority: 'MEDIUM' },
  { title: 'Staff data protection training', description: 'All staff with access to personal data have completed awareness training.', priority: 'MEDIUM' },
  { title: 'Third-party processors reviewed', description: 'Data processing agreements are signed with all vendors handling school data.', priority: 'LOW' },
  { title: 'Regular backups verified', description: 'Backups are taken on schedule and a restore has been tested.', priority: 'MEDIUM' },
]

const defaultPolicies = [
  { dataType: 'Student academic records', retentionPeriod: 'Until student reaches age 25', purpose: 'Transcripts, verification requests and statutory record keeping.' },
  { dataType: 'Admission applications (not enrolled)', retentionPeriod: '1 year', purpose: 'Handling re-applications and admission queries.' },
  { dataType: 'Fee and payment records', retentionPeriod: '8 years', purpose: 'Tax, audit and accounting obligations.' },
  { dataType: 'Staff employment records', retentionPeriod: '7 years after leaving', purpose: 'Employment law, references and payroll audits.' },
  { dataType: 'Attendance registers', retentionPeriod: '3 years', purpose: 'Safeguarding and regulatory reporting.' },
  { dataType: 'Audit logs', retentionPeriod: '2 years', purpose: 'Security monitoring and incident investigation.' },
]

const meta = (record: ComplianceRecord): Record<string, unknown> =>
  record.documents && typeof record.documents === 'object' && !Array.isArray(record.documents)
    ? (record.documents as Record<string, unknown>)
    : {}

const isCompliant = (status: string) => ['COMPLIANT', 'COMPLETED'].includes(status.toUpperCase())

function toChecklistItem(record: ComplianceRecord) {
  const m = meta(record)
  return {
    id: record.id,
    title: (m.title as string) || record.description || 'Compliance item',
    description: m.title ? record.description || '' : '',
    priority: (m.priority as string) || 'MEDIUM',
    completed: isCompliant(record.status),
    status: record.status,
    updatedAt: record.updatedAt,
  }
}

function toPolicy(record: ComplianceRecord) {
  const m = meta(record)
  return {
    id: record.id,
    dataType: (m.dataType as string) || record.description || 'Data',
    retentionPeriod: (m.retentionPeriod as string) || 'Not specified',
    purpose: (m.purpose as string) || (m.dataType ? record.description || '' : ''),
    isActive: record.isActive,
  }
}

export const GET = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    // Role check
    if (!session || !hasMinimumRole(session.user.role, 'SCHOOL_ADMIN')) {
      return errorResponse('Access denied', 403)
    }

    const schoolId = session.user.schoolId
    if (!schoolId) {
      return successResponse({ gdprCompliance: [], dataRetentionPolicies: [], complianceScore: 0 })
    }

    const load = () =>
      prisma.complianceRecord.findMany({
        where: { schoolId, complianceType: { in: [GDPR, RETENTION] } },
        orderBy: { createdAt: 'asc' },
      })

    let records = await load()

    // First visit for a school: create the standard checklist / policies so they can be tracked.
    // Done under a per-school advisory lock so two simultaneous first loads cannot both seed.
    if (
      !records.some((r) => r.complianceType === GDPR) ||
      !records.some((r) => r.complianceType === RETENTION)
    ) {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'compliance-seed:' + schoolId}))`

        const existing = await tx.complianceRecord.findMany({
          where: { schoolId, complianceType: { in: [GDPR, RETENTION] } },
          select: { complianceType: true },
        })
        const hasGdpr = existing.some((r) => r.complianceType === GDPR)
        const hasRetention = existing.some((r) => r.complianceType === RETENTION)

        const now = new Date()
        const rows: Prisma.ComplianceRecordCreateManyInput[] = []
        if (!hasGdpr) {
          defaultChecklist.forEach((item, i) =>
            rows.push({
              schoolId,
              complianceType: GDPR,
              description: item.description,
              status: 'PENDING',
              validFrom: now,
              documents: { title: item.title, priority: item.priority },
              createdAt: new Date(now.getTime() + i),
            })
          )
        }
        if (!hasRetention) {
          defaultPolicies.forEach((policy, i) =>
            rows.push({
              schoolId,
              complianceType: RETENTION,
              description: policy.purpose,
              status: 'ACTIVE',
              validFrom: now,
              documents: policy,
              createdAt: new Date(now.getTime() + 100 + i),
            })
          )
        }
        if (rows.length > 0) {
          await tx.complianceRecord.createMany({ data: rows })
        }
      })
      records = await load()
    }

    const gdprCompliance = records.filter((r) => r.complianceType === GDPR).map(toChecklistItem)
    const dataRetentionPolicies = records.filter((r) => r.complianceType === RETENTION).map(toPolicy)
    const complianceScore = gdprCompliance.length
      ? Math.round((gdprCompliance.filter((i) => i.completed).length / gdprCompliance.length) * 100)
      : 0

    return successResponse({ gdprCompliance, dataRetentionPolicies, complianceScore })
  },
  { requireAuth: true, module: 'security' }
)

export const POST = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    // Role check
    if (!session || !hasMinimumRole(session.user.role, 'SCHOOL_ADMIN')) {
      return errorResponse('Access denied', 403)
    }

    let body
    try {
      body = await request.json()
    } catch {
      return errorResponse('Invalid JSON in request body', 400)
    }

    const {
      complianceType, description, status, validFrom, validUntil, isActive,
      title, priority, dataType, retentionPeriod, purpose, documents,
    } = body

    const schoolId = session.user.schoolId
    if (!schoolId) {
      return errorResponse('School ID is required', 400)
    }

    const type = typeof complianceType === 'string' && complianceType ? complianceType : GDPR
    const from = validFrom ? new Date(validFrom) : new Date()
    const until = validUntil ? new Date(validUntil) : null
    if (isNaN(from.getTime()) || (until && isNaN(until.getTime()))) {
      return errorResponse('Invalid date', 400)
    }

    const extra =
      type === RETENTION
        ? { dataType, retentionPeriod, purpose }
        : { title, priority: priority || 'MEDIUM' }
    const docs = {
      ...(documents && typeof documents === 'object' && !Array.isArray(documents) ? documents : {}),
      ...Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== undefined && v !== '')),
    }

    const complianceRecord = await prisma.complianceRecord.create({
      data: {
        schoolId,
        complianceType: type,
        description: description || purpose || null,
        status: typeof status === 'string' && status ? status : type === GDPR ? 'PENDING' : 'ACTIVE',
        validFrom: from,
        validUntil: until,
        documents: docs as Prisma.InputJsonValue,
        isActive: isActive ?? true,
      }
    })

    await logAudit(session, request, 'CREATE', 'ComplianceRecord', complianceRecord.id, { complianceType: type })

    return successResponse(complianceRecord, 201)
  },
  { requireAuth: true, module: 'security' }
)
