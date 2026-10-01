import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  getSchoolFilter,
  getPaginationParams,
  successResponse,
  validationErrorResponse,
  validateBody,
  AuthenticatedSession,
  paginatedResponse,
} from '@/lib/api-utils'
import { smartWalletSchema } from '@/lib/validations'

export const GET = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get('studentId')
    const isActive = searchParams.get('isActive')
    const pagination = getPaginationParams(request)
    // The wallet page lists every wallet and totals balances from the list
    if (!searchParams.has('limit')) {
      pagination.limit = 2000
      pagination.skip = (pagination.page - 1) * pagination.limit
    }

    // Every active student has a wallet. There is no "create wallet" screen, so
    // open the missing ones (zero balance) for the caller's school on first view.
    if (session?.user.schoolId) {
      const missing = await prisma.student.findMany({
        where: { schoolId: session.user.schoolId, isActive: true, smartWallet: null },
        select: { id: true },
      })
      if (missing.length) {
        await prisma.smartWallet.createMany({
          data: missing.map((student) => ({ studentId: student.id })),
          skipDuplicates: true,
        })
      }
    }

    const where: any = {}

    if (studentId) {
      where.studentId = studentId
    }

    if (isActive !== null) {
      where.isActive = isActive === 'true'
    }

    // Filter by school through student relationship
    const schoolFilter = getSchoolFilter(session)
    if (schoolFilter.schoolId) {
      where.student = {
        schoolId: schoolFilter.schoolId,
      }
    }

    const [wallets, total] = await Promise.all([
      prisma.smartWallet.findMany({
        where,
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              rollNumber: true,
              admissionNumber: true,
              class: {
                select: {
                  name: true,
                  grade: true,
                },
              },
              section: { select: { name: true } },
            },
          },
          transactions: {
            take: 5,
            orderBy: {
              createdAt: 'desc',
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.smartWallet.count({ where }),
    ])

    // Flat fields the wallet page renders
    const data = wallets.map((wallet) => ({
      ...wallet,
      studentName: `${wallet.student.firstName} ${wallet.student.lastName}`.trim(),
      admissionNumber: wallet.student.admissionNumber,
      className: [wallet.student.class?.name, wallet.student.section?.name].filter(Boolean).join(' - '),
      lastTransaction: wallet.transactions[0]?.createdAt ?? null,
    }))

    return paginatedResponse(data, total, pagination)
  },
  { requireAuth: true, module: 'canteen' }
)

export const POST = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const { data, errors } = await validateBody(request, smartWalletSchema)

    if (errors) {
      return validationErrorResponse(errors)
    }

    // Verify student belongs to the school
    const schoolFilter = getSchoolFilter(session)
    if (schoolFilter.schoolId) {
      const student = await prisma.student.findFirst({
        where: {
          id: data!.studentId,
          schoolId: schoolFilter.schoolId,
        },
      })

      if (!student) {
        return validationErrorResponse({
          studentId: ['Student not found in your school'],
        })
      }
    }

    // Check if wallet already exists for this student
    const existingWallet = await prisma.smartWallet.findUnique({
      where: {
        studentId: data!.studentId,
      },
    })

    if (existingWallet) {
      return validationErrorResponse({
        studentId: ['Wallet already exists for this student'],
      })
    }

    const wallet = await prisma.smartWallet.create({
      data: data!,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            rollNumber: true,
          },
        },
      },
    })

    return successResponse(wallet, 201)
  },
  { requireAuth: true, module: 'canteen' }
)
