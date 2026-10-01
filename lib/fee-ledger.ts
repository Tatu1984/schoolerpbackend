import prisma from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

/**
 * Per-student fee ledger.
 *
 * A student's dues are made of:
 *  - FeePayment rows (invoices) that are not cancelled, and
 *  - active Fee definitions that apply to the student (school-wide or for the
 *    student's class) which have not been invoiced yet. Those get a FeePayment
 *    row created the first time money is collected against them.
 */

export interface LedgerLine {
  feeId: string
  feeName: string
  feePaymentId: string | null
  amount: number
  paidAmount: number
  due: number
  dueDate: Date | null
}

export interface StudentLedger {
  totalFee: number
  feePaid: number
  feeDue: number
  lines: LedgerLine[]
}

type FeeLite = { id: string; name: string; amount: number; classId: string | null; schoolId: string }
type PaymentLite = {
  id: string
  studentId: string
  feeId: string
  amount: number
  paidAmount: number
  dueDate: Date
  fee: { name: string }
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function buildLedger(
  student: { id: string; classId: string; schoolId: string },
  fees: FeeLite[],
  payments: PaymentLite[]
): StudentLedger {
  const lines: LedgerLine[] = []
  const invoicedFeeIds = new Set<string>()

  for (const p of payments) {
    if (p.studentId !== student.id) continue
    invoicedFeeIds.add(p.feeId)
    lines.push({
      feeId: p.feeId,
      feeName: p.fee.name,
      feePaymentId: p.id,
      amount: p.amount,
      paidAmount: p.paidAmount,
      due: round2(Math.max(0, p.amount - p.paidAmount)),
      dueDate: p.dueDate,
    })
  }

  for (const f of fees) {
    if (f.schoolId !== student.schoolId) continue
    if (f.classId && f.classId !== student.classId) continue
    if (invoicedFeeIds.has(f.id)) continue
    lines.push({
      feeId: f.id,
      feeName: f.name,
      feePaymentId: null,
      amount: f.amount,
      paidAmount: 0,
      due: round2(f.amount),
      dueDate: null,
    })
  }

  // Oldest invoices first, then not-yet-invoiced fees
  lines.sort((a, b) => {
    if (a.dueDate && b.dueDate) return a.dueDate.getTime() - b.dueDate.getTime()
    if (a.dueDate) return -1
    if (b.dueDate) return 1
    return 0
  })

  const totalFee = round2(lines.reduce((s, l) => s + l.amount, 0))
  const feePaid = round2(lines.reduce((s, l) => s + l.paidAmount, 0))
  const feeDue = round2(lines.reduce((s, l) => s + l.due, 0))
  return { totalFee, feePaid, feeDue, lines }
}

export async function loadLedgerInputs(
  studentWhere: Prisma.StudentWhereInput,
  db: Prisma.TransactionClient | typeof prisma = prisma
) {
  const students = await db.student.findMany({
    where: studentWhere,
    select: {
      id: true,
      schoolId: true,
      classId: true,
      firstName: true,
      lastName: true,
      admissionNumber: true,
      rollNumber: true,
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
    },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  })
  if (students.length === 0) return { students, fees: [], payments: [] }

  const schoolIds = Array.from(new Set(students.map((s) => s.schoolId)))
  const [fees, payments] = await Promise.all([
    db.fee.findMany({
      where: { schoolId: { in: schoolIds }, isActive: true },
      select: { id: true, name: true, amount: true, classId: true, schoolId: true },
      orderBy: { createdAt: 'asc' },
    }),
    db.feePayment.findMany({
      where: {
        schoolId: { in: schoolIds },
        studentId: { in: students.map((s) => s.id) },
        status: { not: 'CANCELLED' },
      },
      select: {
        id: true,
        studentId: true,
        feeId: true,
        amount: true,
        paidAmount: true,
        dueDate: true,
        fee: { select: { name: true } },
      },
      orderBy: { dueDate: 'asc' },
    }),
  ])

  return { students, fees, payments }
}
