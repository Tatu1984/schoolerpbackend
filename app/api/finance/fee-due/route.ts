import { NextRequest } from 'next/server'
import { withApiHandler, successResponse } from '@/lib/api-utils'
import { schoolWhere } from '@/lib/school-scope'
import { buildLedger, loadLedgerInputs } from '@/lib/fee-ledger'

// GET /api/finance/fee-due
// One row per active student with fee totals, shaped for the fee collection screen:
// { id, firstName, lastName, admissionNumber, class, section, totalFee, feePaid, feeDue, fees[] }
// ?dueOnly=true limits the list to students who still owe something.
export const GET = withApiHandler(
  async (request: NextRequest, _context, session) => {
    const { searchParams } = new URL(request.url)
    const dueOnly = searchParams.get('dueOnly') === 'true'
    const classId = searchParams.get('classId')

    const { students, fees, payments } = await loadLedgerInputs({
      ...schoolWhere(session),
      isActive: true,
      ...(classId && { classId }),
    })

    const paymentsByStudent = new Map<string, typeof payments>()
    for (const p of payments) {
      const list = paymentsByStudent.get(p.studentId)
      if (list) list.push(p)
      else paymentsByStudent.set(p.studentId, [p])
    }

    const rows = students.map((student) => {
      const ledger = buildLedger(student, fees, paymentsByStudent.get(student.id) || [])
      return {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        admissionNumber: student.admissionNumber,
        rollNumber: student.rollNumber,
        class: student.class,
        section: student.section,
        totalFee: ledger.totalFee,
        feePaid: ledger.feePaid,
        feeDue: ledger.feeDue,
        fees: ledger.lines.map((l) => ({
          feeId: l.feeId,
          name: l.feeName,
          amount: l.amount,
          paid: l.paidAmount,
          due: l.due,
          dueDate: l.dueDate,
        })),
      }
    })

    return successResponse(dueOnly ? rows.filter((r) => r.feeDue > 0) : rows)
  },
  { requireAuth: true, module: 'finance' }
)
