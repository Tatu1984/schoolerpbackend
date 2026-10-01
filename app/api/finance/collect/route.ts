import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { PaymentMode } from '@prisma/client'
import { withApiHandler, successResponse, errorResponse, notFoundResponse } from '@/lib/api-utils'
import { schoolWhere, parseDate } from '@/lib/school-scope'
import { buildLedger, loadLedgerInputs } from '@/lib/fee-ledger'

const MODE_ALIASES: Record<string, PaymentMode> = {
  ONLINE: 'NET_BANKING',
  NETBANKING: 'NET_BANKING',
  BANK_TRANSFER: 'NET_BANKING',
  DEBIT_CARD: 'CARD',
  CREDIT_CARD: 'CARD',
}

function toPaymentMode(value: unknown): PaymentMode {
  const key = String(value || 'CASH').trim().toUpperCase().replace(/[\s-]+/g, '_')
  if (key in PaymentMode) return key as PaymentMode
  return MODE_ALIASES[key] || 'OTHER'
}

const round2 = (n: number) => Math.round(n * 100) / 100

// POST /api/finance/collect
// Body: { studentId, amount, mode, date, transactionId?, notes? }
// Applies the amount to the student's outstanding fees, oldest first.
export const POST = withApiHandler(
  async (request: NextRequest, _context, session) => {
    const body = await request.json().catch(() => null)
    if (!body) return errorResponse('Invalid request body')

    const studentId = body.studentId ? String(body.studentId) : ''
    const amount = round2(Number(body.amount))
    if (!studentId) return errorResponse('Student is required')
    if (!isFinite(amount) || amount <= 0) return errorResponse('Payment amount must be greater than zero')

    const parsedDate = parseDate(body.date ?? body.paymentDate)
    if (parsedDate === undefined) return errorResponse('Invalid payment date')
    const paymentDate = parsedDate || new Date()
    const paymentMode = toPaymentMode(body.mode ?? body.paymentMode)
    const transactionId = body.transactionId ? String(body.transactionId) : null
    const notes = body.notes ? String(body.notes) : null

    const result = await prisma.$transaction(async (tx) => {
      const { students, fees, payments } = await loadLedgerInputs(
        { id: studentId, ...schoolWhere(session) },
        tx
      )
      const student = students[0]
      if (!student) return { error: 'not_found' as const }

      const ledger = buildLedger(student, fees, payments)
      if (ledger.feeDue <= 0) return { error: 'This student has no outstanding fees' }
      if (amount > ledger.feeDue + 0.001) {
        return { error: `Amount exceeds the outstanding due of Rs. ${ledger.feeDue}` }
      }

      const receiptNumber = `RCP-${paymentDate.getFullYear()}${String(paymentDate.getMonth() + 1).padStart(2, '0')}-${Date.now().toString(36).toUpperCase()}`
      let remaining = amount
      const applied: { feePaymentId: string; feeName: string; amount: number; status: string }[] = []

      for (const line of ledger.lines) {
        if (remaining <= 0) break
        if (line.due <= 0) continue

        const pay = round2(Math.min(remaining, line.due))
        const newPaid = round2(line.paidAmount + pay)
        const status = newPaid >= line.amount - 0.001 ? 'PAID' : 'PARTIAL'
        const common = { paidAmount: newPaid, status, paymentDate, paymentMode, receiptNumber, transactionId, notes } as const

        const row = line.feePaymentId
          ? await tx.feePayment.update({ where: { id: line.feePaymentId }, data: common })
          : await tx.feePayment.create({
              data: {
                schoolId: student.schoolId,
                studentId: student.id,
                feeId: line.feeId,
                amount: line.amount,
                dueDate: paymentDate,
                ...common,
              },
            })

        applied.push({ feePaymentId: row.id, feeName: line.feeName, amount: pay, status })
        remaining = round2(remaining - pay)
      }

      return {
        receiptNumber,
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`,
        amount,
        paymentMode,
        paymentDate,
        applied,
        totalFee: ledger.totalFee,
        feePaid: round2(ledger.feePaid + amount),
        feeDue: round2(ledger.feeDue - amount),
      }
    })

    if ('error' in result) {
      if (result.error === 'not_found') return notFoundResponse('Student not found')
      return errorResponse(result.error || 'Unable to collect payment')
    }

    return successResponse(result, 201)
  },
  { requireAuth: true, module: 'finance' }
)
