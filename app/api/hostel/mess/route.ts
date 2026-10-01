import { NextRequest } from 'next/server'
import { withApiHandler, successResponse, errorResponse } from '@/lib/api-utils'

// Mess plans (planName / mealType / menu / date / price) have no table in the
// Prisma schema yet, so there is nothing to read or write. GET returns an empty
// list so the screen renders; writes are rejected explicitly rather than
// pretending to save.
const MESS_NOT_PERSISTED =
  'Mess plans cannot be saved yet: the database has no mess plan table.'

export const GET = withApiHandler(
  async (_request: NextRequest) => successResponse([]),
  { requireAuth: true, module: 'hostel' }
)

export const POST = withApiHandler(
  async (_request: NextRequest) => errorResponse(MESS_NOT_PERSISTED, 501),
  { requireAuth: true, module: 'hostel' }
)
