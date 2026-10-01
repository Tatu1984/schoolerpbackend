import { FormBody, num, str } from '@/lib/form-body'

type ExpenseRow = { category: string; date: Date }

// The expenses page reads `expenseType`. The Expense model has no such column,
// so it mirrors `category` (accepted on save but not persisted separately).
export function toPageExpense<T extends ExpenseRow>(expense: T) {
  return {
    ...expense,
    expenseType: expense.category,
  }
}

/** Map form state onto expenseSchema input; only keys present in the body are returned. */
export function normalizeExpenseBody(body: FormBody): FormBody {
  const out: FormBody = {}
  // Fall back to the page's "expense type" when no category was entered
  const category = str(body.category) ?? str(body.expenseType)
  if (body.category !== undefined || body.expenseType !== undefined) out.category = category ?? ''
  if (body.amount !== undefined) out.amount = num(body.amount)
  // A blank date must fail validation (dateString accepts '')
  if (body.date !== undefined) out.date = str(body.date) ?? 'invalid'
  if (body.description !== undefined) out.description = str(body.description)
  if (body.paidTo !== undefined) out.paidTo = str(body.paidTo)
  if (body.paymentMode !== undefined) out.paymentMode = str(body.paymentMode)
  if (body.billNumber !== undefined) out.billNumber = str(body.billNumber)
  if (body.approvedBy !== undefined) out.approvedBy = str(body.approvedBy)
  return out
}
