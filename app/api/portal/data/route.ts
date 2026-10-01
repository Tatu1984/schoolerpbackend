import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  withApiHandler,
  successResponse,
  forbiddenResponse,
  AuthenticatedSession,
} from '@/lib/api-utils'

// Everything a student (or a parent, for one of their children) sees in the portal.
export const GET = withApiHandler(
  async (request: NextRequest, _context, session: AuthenticatedSession | null) => {
    const user = session!.user
    if (user.role !== 'STUDENT' && user.role !== 'PARENT') return forbiddenResponse()

    const children = await prisma.student.findMany({
      where:
        user.role === 'STUDENT'
          ? { userId: user.id }
          : { guardians: { some: { userId: user.id } } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        admissionNumber: true,
        rollNumber: true,
        photo: true,
        classId: true,
        schoolId: true,
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
      },
      orderBy: { firstName: 'asc' },
    })

    if (children.length === 0) {
      return successResponse({ role: user.role, children: [], student: null })
    }

    const requested = new URL(request.url).searchParams.get('studentId')
    const student = children.find((c) => c.id === requested) || children[0]

    const since = new Date()
    since.setUTCDate(since.getUTCDate() - 90)

    const [attendance, fees, courses, examResults, reportCards, announcements] = await Promise.all([
      prisma.studentAttendance.findMany({
        where: { studentId: student.id, date: { gte: since } },
        select: { date: true, status: true, remarks: true },
        orderBy: { date: 'desc' },
      }),
      prisma.feePayment.findMany({
        where: { studentId: student.id },
        include: { fee: { select: { name: true, type: true, frequency: true } } },
        orderBy: { dueDate: 'desc' },
      }),
      prisma.course.findMany({
        where: { schoolId: student.schoolId, classId: student.classId, isActive: true },
        select: {
          id: true,
          name: true,
          code: true,
          subject: { select: { name: true } },
          teacher: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.examResult.findMany({
        where: { studentId: student.id },
        include: {
          exam: {
            select: { title: true, examDate: true, maxScore: true, course: { select: { name: true } } },
          },
        },
        orderBy: { exam: { examDate: 'desc' } },
      }),
      prisma.reportCard.findMany({
        where: { studentId: student.id, isPublished: true },
        include: { academicYear: { select: { name: true } } },
        orderBy: { publishedAt: 'desc' },
      }),
      prisma.announcement.findMany({
        where: {
          schoolId: student.schoolId,
          isActive: true,
          AND: [
            { OR: [{ targetRole: null }, { targetRole: { in: ['', 'ALL', user.role] } }] },
            { OR: [{ targetClass: null }, { targetClass: { in: ['', 'ALL', student.classId] } }] },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
    ])

    const courseIds = courses.map((c) => c.id)
    const classWindow = new Date()
    classWindow.setUTCDate(classWindow.getUTCDate() - 30)

    const [assignments, exams, onlineClasses] = await Promise.all([
      prisma.assignment.findMany({
        where: { courseId: { in: courseIds }, isActive: true },
        include: {
          course: { select: { name: true } },
          submissions: {
            where: { studentId: student.id },
            select: { id: true, content: true, score: true, feedback: true, submittedAt: true, gradedAt: true },
          },
        },
        orderBy: { dueDate: 'desc' },
      }),
      prisma.exam.findMany({
        where: { courseId: { in: courseIds }, isActive: true, examDate: { gte: new Date() } },
        select: { id: true, title: true, examDate: true, duration: true, maxScore: true, course: { select: { name: true } } },
        orderBy: { examDate: 'asc' },
      }),
      prisma.onlineClass.findMany({
        where: {
          schoolId: student.schoolId,
          scheduledTime: { gte: classWindow },
          OR: [{ courseId: { in: courseIds } }, { courseId: null }],
        },
        include: {
          course: { select: { name: true, teacher: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: { scheduledTime: 'asc' },
      }),
    ])

    const counts = { PRESENT: 0, ABSENT: 0, LATE: 0, LEAVE: 0 } as Record<string, number>
    attendance.forEach((a) => {
      counts[a.status] = (counts[a.status] || 0) + 1
    })
    const attended = counts.PRESENT + counts.LATE
    const totalDue = fees
      .filter((f) => f.status !== 'PAID' && f.status !== 'CANCELLED')
      .reduce((sum, f) => sum + (f.amount - f.paidAmount), 0)

    return successResponse({
      role: user.role,
      children,
      student,
      attendance: {
        records: attendance,
        summary: {
          ...counts,
          total: attendance.length,
          percentage: attendance.length ? Math.round((attended / attendance.length) * 100) : null,
        },
      },
      fees: { items: fees, totalDue, totalPaid: fees.reduce((sum, f) => sum + f.paidAmount, 0) },
      courses,
      assignments: assignments.map(({ submissions, ...a }) => ({ ...a, submission: submissions[0] || null })),
      exams,
      examResults,
      reportCards,
      onlineClasses,
      announcements,
    })
  },
  { requireAuth: true }
)
