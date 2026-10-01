import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  getSchoolFilter,
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
  AuthenticatedSession,
} from '@/lib/api-utils'
import {
  buildCommonUpdate,
  getMeta,
  metaToJson,
  prospectToClient,
  PROSPECT_SOURCES,
  PROSPECT_STATUSES,
} from '../../helpers'

export const GET = withApiHandler(
  async (_request: NextRequest, { params }, session: AuthenticatedSession | null) => {
    const prospect = await prisma.admission.findFirst({
      where: { id: params.id, ...getSchoolFilter(session) },
    })
    if (!prospect) {
      return notFoundResponse('Prospect not found')
    }
    return successResponse(prospectToClient(prospect))
  },
  { requireAuth: true, module: 'admissions' }
)

export const PUT = withApiHandler(
  async (request: NextRequest, { params }, session: AuthenticatedSession | null) => {
    // Check if prospect exists and belongs to user's school
    const existing = await prisma.admission.findFirst({
      where: { id: params.id, ...getSchoolFilter(session) },
    })
    if (!existing) {
      return notFoundResponse('Prospect not found')
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return errorResponse('Invalid request body')
    }

    const { data, errors } = buildCommonUpdate(body)
    if (errors) {
      return validationErrorResponse(errors)
    }

    // `status` and `source` here are the page's lead-tracking values
    const meta = getMeta(existing)
    if (body.status !== undefined) {
      if (!PROSPECT_STATUSES.includes(body.status)) {
        return validationErrorResponse({ status: ['Invalid prospect status'] })
      }
      meta.prospectStatus = body.status
    }
    if (body.source !== undefined) {
      if (!PROSPECT_SOURCES.includes(body.source)) {
        return validationErrorResponse({ source: ['Invalid source'] })
      }
      meta.source = body.source
    }
    data.documents = metaToJson(meta)

    const prospect = await prisma.admission.update({
      where: { id: params.id },
      data,
    })

    return successResponse(prospectToClient(prospect))
  },
  { requireAuth: true, module: 'admissions' }
)

export const DELETE = withApiHandler(
  async (_request: NextRequest, { params }, session: AuthenticatedSession | null) => {
    // Check if prospect exists and belongs to user's school
    const existing = await prisma.admission.findFirst({
      where: { id: params.id, ...getSchoolFilter(session) },
    })
    if (!existing) {
      return notFoundResponse('Prospect not found')
    }
    if (existing.studentId) {
      return errorResponse('This prospect is already enrolled as a student and cannot be deleted', 409)
    }

    await prisma.admission.delete({ where: { id: params.id } })

    return successResponse({ message: 'Prospect deleted successfully' })
  },
  { requireAuth: true, module: 'admissions' }
)
