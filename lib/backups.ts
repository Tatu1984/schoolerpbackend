import path from 'path'
import { promises as fs } from 'fs'
import prisma from '@/lib/prisma'
import type { DataBackup } from '@prisma/client'
import type { AuthenticatedSession } from '@/lib/api-utils'

/**
 * Backups are JSON snapshots of one school's records, written to BACKUP_DIR
 * (default ./backups) and indexed by a DataBackup row.
 *
 * DataBackup has no schoolId column, so ownership is carried in the file name:
 *   backup-<schoolId>-<timestamp>.json
 */
export const BACKUP_DIR = path.resolve(process.env.BACKUP_DIR || path.join(process.cwd(), 'backups'))

export const backupFilePrefix = (schoolId: string) => `backup-${schoolId}-`

/** Where clause limiting DataBackup rows to the ones the caller may see. */
export function backupWhere(session: AuthenticatedSession | null) {
  if (session?.user.role === 'SUPER_ADMIN') return {}
  return { fileName: { startsWith: backupFilePrefix(session?.user.schoolId || '__no_school__') } }
}

/** Shape used by the backup screen (type / size in MB) plus the raw columns. */
export function toBackupRow(b: DataBackup) {
  return {
    id: b.id,
    type: b.backupType,
    backupType: b.backupType,
    fileName: b.fileName,
    size: b.fileSize ?? 0,
    fileSize: b.fileSize,
    status: b.status,
    startedAt: b.startedAt,
    completedAt: b.completedAt,
    createdAt: b.createdAt,
  }
}

/** Absolute path of a backup file, or null if the stored location escapes BACKUP_DIR. */
export function resolveBackupPath(b: Pick<DataBackup, 'fileName'>): string | null {
  const full = path.resolve(BACKUP_DIR, path.basename(b.fileName))
  return full.startsWith(BACKUP_DIR + path.sep) ? full : null
}

/** Collects everything owned by one school. Login accounts (password hashes) are deliberately left out. */
export async function buildSchoolSnapshot(schoolId: string) {
  const bySchool = { where: { schoolId } }
  const [
    school, branches, academicYears, classes, sections, subjects, students, guardians, staff,
    fees, feePayments, expenses, libraries, books, libraryIssues, hostels, vendors,
    purchaseOrders, assets, routes, vehicles, drivers, leaveRequests,
  ] = await Promise.all([
    prisma.school.findUnique({ where: { id: schoolId } }),
    prisma.branch.findMany(bySchool),
    prisma.academicYear.findMany(bySchool),
    prisma.class.findMany(bySchool),
    prisma.section.findMany({ where: { class: { schoolId } } }),
    prisma.subject.findMany(bySchool),
    prisma.student.findMany(bySchool),
    prisma.guardian.findMany({ where: { student: { schoolId } } }),
    prisma.staff.findMany(bySchool),
    prisma.fee.findMany(bySchool),
    prisma.feePayment.findMany(bySchool),
    prisma.expense.findMany(bySchool),
    prisma.library.findMany(bySchool),
    prisma.book.findMany({ where: { library: { schoolId } } }),
    prisma.libraryIssue.findMany({ where: { book: { library: { schoolId } } } }),
    prisma.hostel.findMany({
      ...bySchool,
      include: { floors: { include: { rooms: { include: { beds: true } } } }, students: true },
    }),
    prisma.vendor.findMany(bySchool),
    prisma.purchaseOrder.findMany({ ...bySchool, include: { items: true } }),
    prisma.asset.findMany(bySchool),
    prisma.route.findMany(bySchool),
    prisma.vehicle.findMany(bySchool),
    prisma.driver.findMany(bySchool),
    prisma.leaveRequest.findMany({ where: { staff: { schoolId } } }),
  ])

  const tables = {
    school: school ? [school] : [],
    branches, academicYears, classes, sections, subjects, students, guardians, staff,
    fees, feePayments, expenses, libraries, books, libraryIssues, hostels, vendors,
    purchaseOrders, assets, routes, vehicles, drivers, leaveRequests,
  }
  const counts = Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length]))

  return { version: 1, schoolId, generatedAt: new Date().toISOString(), counts, tables }
}

/** Creates the snapshot file and its DataBackup row. Records a FAILED row if writing fails. */
export async function createBackup(schoolId: string, backupType: string): Promise<DataBackup> {
  const startedAt = new Date()
  const fileName = `${backupFilePrefix(schoolId)}${startedAt.toISOString().replace(/[:.]/g, '-')}.json`
  const location = path.join(BACKUP_DIR, fileName)

  try {
    const snapshot = await buildSchoolSnapshot(schoolId)
    const json = JSON.stringify(snapshot, null, 2)
    await fs.mkdir(BACKUP_DIR, { recursive: true })
    await fs.writeFile(location, json, 'utf8')
    const sizeMb = Math.round((Buffer.byteLength(json, 'utf8') / (1024 * 1024)) * 100) / 100

    return await prisma.dataBackup.create({
      data: { backupType, fileName, fileSize: sizeMb, location, status: 'COMPLETED', startedAt, completedAt: new Date() },
    })
  } catch (error) {
    console.error('Backup failed:', error)
    await fs.unlink(location).catch(() => {})
    return prisma.dataBackup.create({
      data: { backupType, fileName, fileSize: 0, location, status: 'FAILED', startedAt, completedAt: new Date() },
    })
  }
}
