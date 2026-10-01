import { NextRequest } from 'next/server'
import { withApiHandler, errorResponse } from '@/lib/api-utils'

// See ../route.ts - there is no mess plan table, so individual plans cannot exist.
const MESS_NOT_PERSISTED =
  'Mess plans cannot be saved yet: the database has no mess plan table.'

export const PUT = withApiHandler(
  async (_request: NextRequest) => errorResponse(MESS_NOT_PERSISTED, 501),
  { requireAuth: true, module: 'hostel' }
)

export const DELETE = withApiHandler(
  async (_request: NextRequest) => errorResponse(MESS_NOT_PERSISTED, 501),
  { requireAuth: true, module: 'hostel' }
)
