import { hash } from 'bcryptjs'
import prisma from './prisma'

// Portal logins are created automatically when a student is admitted.
// The initial password is temporary: the user must choose their own at first sign-in.
// Student: password = date of birth as DDMMYYYY. Parent: password = last 10 digits of phone.

function ddmmyyyy(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getUTCDate())}${p(d.getUTCMonth() + 1)}${d.getUTCFullYear()}`
}

function digits(phone: string) {
  return phone.replace(/\D/g, '').slice(-10)
}

export async function ensureStudentUser(studentId: string) {
  const student = await prisma.student.findUnique({ where: { id: studentId } })
  if (!student || student.userId) return null

  let email = (student.email || '').toLowerCase().trim()
  if (!email || (await prisma.user.findUnique({ where: { email } }))) {
    email = `${student.admissionNumber.toLowerCase().replace(/[^a-z0-9]/g, '')}@student.school`
  }
  if (await prisma.user.findUnique({ where: { email } })) return null

  const initialPassword = ddmmyyyy(student.dateOfBirth)
  const user = await prisma.user.create({
    data: {
      schoolId: student.schoolId,
      email,
      phone: student.phone,
      password: await hash(initialPassword, 10),
      firstName: student.firstName,
      lastName: student.lastName,
      role: 'STUDENT',
      mustChangePassword: true,
    },
  })
  await prisma.student.update({ where: { id: student.id }, data: { userId: user.id } })
  return { email, initialPassword }
}

export async function ensureGuardianUser(guardianId: string) {
  const guardian = await prisma.guardian.findUnique({
    where: { id: guardianId },
    include: { student: { select: { schoolId: true } } },
  })
  if (!guardian || guardian.userId) return null

  const phone = digits(guardian.phone)
  const email = (guardian.email || '').toLowerCase().trim() || (phone ? `${phone}@parent.school` : '')
  if (!email) return null

  // A parent with several children shares one login
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    if (existing.role !== 'PARENT' || existing.schoolId !== guardian.student.schoolId) return null
    await prisma.guardian.update({ where: { id: guardian.id }, data: { userId: existing.id } })
    return { email, initialPassword: null }
  }

  const initialPassword = phone || 'parent123'
  const user = await prisma.user.create({
    data: {
      schoolId: guardian.student.schoolId,
      email,
      phone: guardian.phone,
      password: await hash(initialPassword, 10),
      firstName: guardian.firstName,
      lastName: guardian.lastName,
      role: 'PARENT',
      mustChangePassword: true,
    },
  })
  await prisma.guardian.update({ where: { id: guardian.id }, data: { userId: user.id } })
  return { email, initialPassword }
}
