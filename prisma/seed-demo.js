// Demo data for the parent / student portals and online classes.
// Safe to re-run: every record is looked up before it is created.
// Run with: npm run db:seed:demo
const { PrismaClient } = require('@prisma/client')
const { hash } = require('bcryptjs')

const prisma = new PrismaClient()

const day = (offset, hour = 0, minute = 0) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  d.setHours(hour, minute, 0, 0)
  return d
}
const dateOnly = (offset) => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offset)
  d.setUTCHours(0, 0, 0, 0)
  return d
}
const ddmmyyyy = (d) =>
  `${String(d.getUTCDate()).padStart(2, '0')}${String(d.getUTCMonth() + 1).padStart(2, '0')}${d.getUTCFullYear()}`

const STUDENTS = [
  { adm: 'ADM2026-001', roll: '1', first: 'Aarav', last: 'Sen', gender: 'MALE', dob: '2019-03-14', parent: { first: 'Rajesh', last: 'Sen', relation: 'Father', phone: '9830011001' } },
  { adm: 'ADM2026-002', roll: '2', first: 'Ananya', last: 'Sen', gender: 'FEMALE', dob: '2019-03-14', parent: { first: 'Rajesh', last: 'Sen', relation: 'Father', phone: '9830011001' } },
  { adm: 'ADM2026-003', roll: '3', first: 'Ishaan', last: 'Mukherjee', gender: 'MALE', dob: '2019-07-02', parent: { first: 'Sharmila', last: 'Mukherjee', relation: 'Mother', phone: '9830011003' } },
  { adm: 'ADM2026-004', roll: '4', first: 'Diya', last: 'Banerjee', gender: 'FEMALE', dob: '2019-11-21', parent: { first: 'Anirban', last: 'Banerjee', relation: 'Father', phone: '9830011004' } },
  { adm: 'ADM2026-005', roll: '5', first: 'Kabir', last: 'Das', gender: 'MALE', dob: '2019-01-09', parent: { first: 'Moumita', last: 'Das', relation: 'Mother', phone: '9830011005' } },
  { adm: 'ADM2026-006', roll: '6', first: 'Riya', last: 'Ghosh', gender: 'FEMALE', dob: '2019-09-30', parent: { first: 'Subrata', last: 'Ghosh', relation: 'Father', phone: '9830011006' } },
]

async function ensureUser({ schoolId, email, password, firstName, lastName, phone, role }) {
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return existing
  return prisma.user.create({
    data: { schoolId, email, phone, firstName, lastName, role, password: await hash(password, 10) },
  })
}

async function main() {
  const school = await prisma.school.findFirst({ orderBy: { createdAt: 'asc' } })
  if (!school) throw new Error('No school found. Create a school first.')
  const schoolId = school.id

  const cls = await prisma.class.findFirst({ where: { schoolId }, orderBy: { createdAt: 'asc' } })
  if (!cls) throw new Error('No class found. Create a class first.')
  const section = await prisma.section.findFirst({ where: { classId: cls.id } })
  const branch = await prisma.branch.findFirst({ where: { schoolId } })
  const year =
    (await prisma.academicYear.findFirst({ where: { schoolId, isCurrent: true } })) ||
    (await prisma.academicYear.findFirst({ where: { schoolId } }))
  const teacher = await prisma.staff.findFirst({ where: { schoolId, isActive: true } })
  console.log(`School: ${school.name} · Class: ${cls.name}${section ? ' ' + section.name : ''}`)

  // ---- Students, guardians and portal logins
  const students = []
  for (const s of STUDENTS) {
    const dob = new Date(`${s.dob}T00:00:00.000Z`)
    let student = await prisma.student.findFirst({ where: { schoolId, admissionNumber: s.adm } })
    if (!student) {
      student = await prisma.student.create({
        data: {
          schoolId,
          branchId: branch?.id,
          classId: cls.id,
          sectionId: section?.id,
          admissionNumber: s.adm,
          rollNumber: s.roll,
          firstName: s.first,
          lastName: s.last,
          gender: s.gender,
          dateOfBirth: dob,
          nationality: 'Indian',
          city: 'Kolkata',
          state: 'West Bengal',
          admissionDate: day(-120),
        },
      })
    }
    if (!student.userId) {
      const user = await ensureUser({
        schoolId,
        email: `${s.first.toLowerCase()}.${s.last.toLowerCase()}@student.school`,
        password: ddmmyyyy(dob),
        firstName: s.first,
        lastName: s.last,
        role: 'STUDENT',
      })
      student = await prisma.student.update({ where: { id: student.id }, data: { userId: user.id } })
    }

    let guardian = await prisma.guardian.findFirst({ where: { studentId: student.id } })
    const parentEmail = `${s.parent.first.toLowerCase()}.${s.parent.last.toLowerCase()}@parent.school`
    if (!guardian) {
      guardian = await prisma.guardian.create({
        data: {
          studentId: student.id,
          relation: s.parent.relation,
          firstName: s.parent.first,
          lastName: s.parent.last,
          phone: s.parent.phone,
          email: parentEmail,
          isPrimary: true,
        },
      })
    }
    if (!guardian.userId) {
      const parentUser = await ensureUser({
        schoolId,
        email: parentEmail,
        password: s.parent.phone,
        firstName: s.parent.first,
        lastName: s.parent.last,
        phone: s.parent.phone,
        role: 'PARENT',
      })
      await prisma.guardian.update({ where: { id: guardian.id }, data: { userId: parentUser.id } })
    }
    students.push(student)
  }
  console.log(`Students ready: ${students.length}`)

  // ---- Attendance: last 30 days, weekdays only
  let attendanceRows = 0
  for (let offset = -30; offset <= 0; offset++) {
    const date = dateOnly(offset)
    if ([0, 6].includes(date.getUTCDay())) continue
    for (const [i, student] of students.entries()) {
      const n = (i * 7 + Math.abs(offset) * 3) % 17
      const status = n === 0 ? 'ABSENT' : n === 5 ? 'LATE' : n === 11 && i % 2 ? 'LEAVE' : 'PRESENT'
      const exists = await prisma.studentAttendance.findUnique({
        where: { studentId_date: { studentId: student.id, date } },
      })
      if (!exists) {
        await prisma.studentAttendance.create({ data: { schoolId, studentId: student.id, date, status } })
        attendanceRows++
      }
    }
  }
  console.log(`Attendance rows added: ${attendanceRows}`)

  // ---- Fees
  const feeDefs = [
    { name: 'Tuition Fee - Q1', type: 'TUITION', amount: 18000, frequency: 'QUARTERLY', due: -75, paid: 'ALL' },
    { name: 'Tuition Fee - Q2', type: 'TUITION', amount: 18000, frequency: 'QUARTERLY', due: 12, paid: 'SOME' },
    { name: 'Transport Fee', type: 'TRANSPORT', amount: 4500, frequency: 'QUARTERLY', due: -5, paid: 'NONE' },
  ]
  for (const def of feeDefs) {
    let fee = await prisma.fee.findFirst({ where: { schoolId, name: def.name, classId: cls.id } })
    if (!fee) {
      fee = await prisma.fee.create({
        data: { schoolId, classId: cls.id, name: def.name, type: def.type, amount: def.amount, frequency: def.frequency },
      })
    }
    for (const [i, student] of students.entries()) {
      const exists = await prisma.feePayment.findFirst({ where: { studentId: student.id, feeId: fee.id } })
      if (exists) continue
      const fullyPaid = def.paid === 'ALL' || (def.paid === 'SOME' && i % 3 === 0)
      const partial = def.paid === 'SOME' && i % 3 === 1
      await prisma.feePayment.create({
        data: {
          schoolId,
          studentId: student.id,
          feeId: fee.id,
          amount: def.amount,
          paidAmount: fullyPaid ? def.amount : partial ? def.amount / 2 : 0,
          dueDate: day(def.due),
          status: fullyPaid ? 'PAID' : partial ? 'PARTIAL' : def.due < 0 ? 'OVERDUE' : 'PENDING',
          paymentDate: fullyPaid || partial ? day(Math.min(def.due, 0) - 3) : null,
          paymentMode: fullyPaid || partial ? 'UPI' : null,
          receiptNumber: fullyPaid || partial ? `RCPT-${def.type.slice(0, 3)}-${def.due < 0 ? 'A' : 'B'}${String(i + 1).padStart(3, '0')}` : null,
        },
      })
    }
  }
  console.log('Fees ready')

  // ---- Courses
  const courseDefs = [
    { code: 'MATH-1', name: 'Mathematics' },
    { code: 'ENG-1', name: 'English' },
    { code: 'EVS-1', name: 'Environmental Studies' },
  ]
  const courses = []
  for (const c of courseDefs) {
    let course = await prisma.course.findFirst({ where: { schoolId, code: c.code } })
    if (!course) {
      course = await prisma.course.create({
        data: { schoolId, classId: cls.id, teacherId: teacher?.id, name: c.name, code: c.code, startDate: day(-120), endDate: day(240) },
      })
    }
    courses.push(course)
  }
  const [math, english, evs] = courses

  // ---- Assignments
  const assignmentDefs = [
    { course: math, title: 'Addition and subtraction worksheet', description: 'Complete exercises 1 to 20 from chapter 3.', due: -6, graded: true },
    { course: english, title: 'My family - short paragraph', description: 'Write five sentences about your family.', due: 2, submitted: true },
    { course: evs, title: 'Plants around us', description: 'Name five plants you see near your home and draw one of them.', due: 6 },
  ]
  for (const def of assignmentDefs) {
    let assignment = await prisma.assignment.findFirst({ where: { courseId: def.course.id, title: def.title } })
    if (!assignment) {
      assignment = await prisma.assignment.create({
        data: { courseId: def.course.id, title: def.title, description: def.description, dueDate: day(def.due, 17), maxScore: 20 },
      })
    }
    if (def.graded || def.submitted) {
      for (const [i, student] of students.entries()) {
        if (def.submitted && i % 2) continue
        const exists = await prisma.assignmentSubmission.findUnique({
          where: { assignmentId_studentId: { assignmentId: assignment.id, studentId: student.id } },
        })
        if (exists) continue
        await prisma.assignmentSubmission.create({
          data: {
            assignmentId: assignment.id,
            studentId: student.id,
            content: 'Completed in notebook, photo shared with class teacher.',
            submittedAt: day(def.due - 1, 18),
            ...(def.graded && { score: 14 + ((i * 3) % 7), feedback: 'Good work. Keep practising.', gradedAt: day(def.due + 1, 11) }),
          },
        })
      }
    }
  }

  // ---- Exams and results
  const examDefs = [
    { course: math, title: 'Unit Test 1 - Mathematics', date: -20, results: true },
    { course: english, title: 'Unit Test 1 - English', date: -18, results: true },
    { course: math, title: 'Half-Yearly - Mathematics', date: 14 },
    { course: english, title: 'Half-Yearly - English', date: 16 },
  ]
  for (const def of examDefs) {
    let exam = await prisma.exam.findFirst({ where: { courseId: def.course.id, title: def.title } })
    if (!exam) {
      exam = await prisma.exam.create({
        data: { courseId: def.course.id, title: def.title, examDate: day(def.date, 10), duration: 60, maxScore: 50 },
      })
    }
    if (def.results) {
      for (const [i, student] of students.entries()) {
        const exists = await prisma.examResult.findUnique({
          where: { examId_studentId: { examId: exam.id, studentId: student.id } },
        })
        if (!exists) {
          await prisma.examResult.create({
            data: { examId: exam.id, studentId: student.id, score: 32 + ((i * 5 + def.title.length) % 17), remarks: 'Well done' },
          })
        }
      }
    }
  }

  // ---- Report cards
  if (year) {
    for (const [i, student] of students.entries()) {
      const exists = await prisma.reportCard.findFirst({
        where: { studentId: student.id, academicYearId: year.id, term: 'Term 1' },
      })
      if (!exists) {
        await prisma.reportCard.create({
          data: {
            studentId: student.id,
            academicYearId: year.id,
            term: 'Term 1',
            grades: { Mathematics: i % 2 ? 'A' : 'A+', English: 'A', 'Environmental Studies': i % 3 ? 'A' : 'B+' },
            overallScore: 82 + ((i * 3) % 12),
            remarks: 'A sincere and attentive student.',
            isPublished: true,
            publishedAt: day(-10),
          },
        })
      }
    }
  }

  // ---- Online classes
  const classDefs = [
    { course: math, title: 'Mathematics - Counting in tens (live demo)', at: day(0, new Date().getHours(), 0), duration: 180, status: 'LIVE' },
    { course: english, title: 'English - Story time and reading', at: day(1, 10, 0), duration: 45, status: 'SCHEDULED' },
    { course: evs, title: 'EVS - Our helpers', at: day(2, 11, 30), duration: 40, status: 'SCHEDULED' },
    { course: math, title: 'Mathematics - Shapes revision', at: day(-3, 10, 0), duration: 45, status: 'COMPLETED' },
  ]
  for (const def of classDefs) {
    const exists = await prisma.onlineClass.findFirst({ where: { schoolId, title: def.title } })
    if (exists && def.status === 'LIVE') {
      // Re-running the seed on demo day moves the live class to "now"
      await prisma.onlineClass.update({ where: { id: exists.id }, data: { scheduledTime: def.at, status: 'LIVE' } })
    }
    if (!exists) {
      await prisma.onlineClass.create({
        data: {
          schoolId,
          courseId: def.course.id,
          title: def.title,
          scheduledTime: def.at,
          duration: def.duration,
          status: def.status,
          meetingLink: `https://meet.jit.si/SchoolERP-${school.id.slice(-6)}-${def.course.code}-${Math.abs(def.at.getDate())}`,
        },
      })
    }
  }

  // ---- Announcements
  const announcementDefs = [
    { title: 'Parent-teacher meeting on Saturday', content: 'The parent-teacher meeting for all classes will be held this Saturday from 10 AM to 1 PM. Please carry the school diary.', priority: 'HIGH' },
    { title: 'Half-yearly examination schedule published', content: 'The half-yearly examination begins in two weeks. The detailed schedule is available under Exams & Results.', priority: 'NORMAL' },
    { title: 'Online classes during the Puja break', content: 'Revision classes will be conducted online during the break. Join links appear under Online Classes ten minutes before each session.', priority: 'NORMAL' },
  ]
  for (const def of announcementDefs) {
    const exists = await prisma.announcement.findFirst({ where: { schoolId, title: def.title } })
    if (!exists) {
      await prisma.announcement.create({ data: { schoolId, ...def, targetRole: 'ALL', publishedAt: new Date() } })
    }
  }

  console.log('\nDemo logins')
  console.log('  Admin    admin@school.com / admin123')
  console.log('  Parent   rajesh.sen@parent.school / 9830011001   (two children: Aarav and Ananya)')
  console.log('  Student  aarav.sen@student.school / 14032019     (date of birth, DDMMYYYY)')
}

main()
  .catch((e) => {
    console.error('Demo seed failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
