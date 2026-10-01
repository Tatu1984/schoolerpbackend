const { PrismaClient } = require('@prisma/client')
const { hash } = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create School
  const school = await prisma.school.upsert({
    where: { code: 'DEMO001' },
    update: {},
    create: {
      name: 'Demo International School',
      code: 'DEMO001',
      address: '123 Education Street',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      pincode: '400001',
      phone: '+91-22-12345678',
      email: 'info@demoschood.edu',
      website: 'https://demoschool.edu',
      principalName: 'Dr. Rajesh Kumar',
      established: new Date('2010-04-01'),
    },
  })
  console.log('✅ School created:', school.name)

  // Create Branch
  const branch = await prisma.branch.upsert({
    where: { id: 'main-branch' },
    update: {},
    create: {
      id: 'main-branch',
      schoolId: school.id,
      name: 'Main Campus',
      code: 'MAIN',
      address: '123 Education Street',
      city: 'Mumbai',
      state: 'Maharashtra',
      phone: '+91-22-12345678',
      email: 'main@demoschool.edu',
    },
  })
  console.log('✅ Branch created:', branch.name)

  // Create Academic Year
  const academicYear = await prisma.academicYear.upsert({
    where: { id: 'ay-2024-25' },
    update: {},
    create: {
      id: 'ay-2024-25',
      schoolId: school.id,
      name: '2024-2025',
      startDate: new Date('2024-04-01'),
      endDate: new Date('2025-03-31'),
      isCurrent: true,
    },
  })
  console.log('✅ Academic year created:', academicYear.name)

  // Create Admin User
  const hashedPassword = await hash('admin123', 10)
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@school.com' },
    update: {},
    create: {
      schoolId: school.id,
      email: 'admin@school.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'SCHOOL_ADMIN',
      phone: '+91-9876543210',
    },
  })
  console.log('✅ Admin user created:', adminUser.email)

  // Create Classes
  const classes = []
  for (let grade = 1; grade <= 12; grade++) {
    const cls = await prisma.class.upsert({
      where: {
        schoolId_academicYearId_name: {
          schoolId: school.id,
          academicYearId: academicYear.id,
          name: `Class ${grade}`,
        },
      },
      update: {},
      create: {
        schoolId: school.id,
        branchId: branch.id,
        academicYearId: academicYear.id,
        name: `Class ${grade}`,
        grade,
        capacity: 40,
        description: `Standard ${grade} curriculum`,
      },
    })
    classes.push(cls)
  }
  console.log(`✅ Created ${classes.length} classes`)

  // Create Sections for each class
  const sections = ['A', 'B', 'C']
  for (const cls of classes.slice(0, 5)) { // Only for first 5 classes
    for (const sectionName of sections) {
      await prisma.section.upsert({
        where: {
          classId_name: {
            classId: cls.id,
            name: sectionName,
          },
        },
        update: {},
        create: {
          classId: cls.id,
          name: sectionName,
          capacity: 40,
        },
      })
    }
  }
  console.log('✅ Created sections for classes')

  // Create Subjects
  const subjects = [
    { name: 'Mathematics', code: 'MATH' },
    { name: 'English', code: 'ENG' },
    { name: 'Science', code: 'SCI' },
    { name: 'Social Studies', code: 'SST' },
    { name: 'Hindi', code: 'HIN' },
    { name: 'Computer Science', code: 'CS', isOptional: true },
    { name: 'Physical Education', code: 'PE' },
    { name: 'Art & Craft', code: 'ART', isOptional: true },
  ]

  for (const subject of subjects) {
    await prisma.subject.upsert({
      where: {
        schoolId_code: {
          schoolId: school.id,
          code: subject.code,
        },
      },
      update: {},
      create: {
        schoolId: school.id,
        name: subject.name,
        code: subject.code,
        isOptional: subject.isOptional || false,
      },
    })
  }
  console.log(`✅ Created ${subjects.length} subjects`)

  // Create Fees
  const fees = [
    { name: 'Tuition Fee', type: 'TUITION', amount: 5000, frequency: 'MONTHLY' },
    { name: 'Admission Fee', type: 'ADMISSION', amount: 10000, frequency: 'ONE_TIME' },
    { name: 'Examination Fee', type: 'EXAMINATION', amount: 1500, frequency: 'HALF_YEARLY' },
    { name: 'Sports Fee', type: 'SPORTS', amount: 500, frequency: 'YEARLY' },
    { name: 'Library Fee', type: 'LIBRARY', amount: 300, frequency: 'YEARLY' },
  ]

  for (const fee of fees) {
    const existingFee = await prisma.fee.findFirst({
      where: {
        schoolId: school.id,
        name: fee.name,
        type: fee.type,
      },
    })
    if (!existingFee) {
      await prisma.fee.create({
        data: {
          schoolId: school.id,
          ...fee,
        },
      })
    }
  }
  console.log(`✅ Created ${fees.length} fee types`)

  // Create Transport Routes
  const routes = [
    { name: 'Route 1 - North Zone', code: 'R1' },
    { name: 'Route 2 - South Zone', code: 'R2' },
    { name: 'Route 3 - East Zone', code: 'R3' },
    { name: 'Route 4 - West Zone', code: 'R4' },
  ]

  for (const route of routes) {
    const createdRoute = await prisma.route.upsert({
      where: {
        schoolId_code: {
          schoolId: school.id,
          code: route.code,
        },
      },
      update: {},
      create: {
        schoolId: school.id,
        ...route,
      },
    })

    // Add stops to each route
    const stops = [
      { name: 'Stop 1', location: 'Area A', sequence: 1, fare: 500 },
      { name: 'Stop 2', location: 'Area B', sequence: 2, fare: 700 },
      { name: 'Stop 3', location: 'Area C', sequence: 3, fare: 900 },
    ]

    for (const stop of stops) {
      const existingStop = await prisma.stop.findFirst({
        where: {
          routeId: createdRoute.id,
          sequence: stop.sequence,
        },
      })
      if (!existingStop) {
        await prisma.stop.create({
          data: {
            routeId: createdRoute.id,
            ...stop,
          },
        })
      }
    }
  }
  console.log(`✅ Created ${routes.length} transport routes with stops`)

  // Create Vehicles
  const vehicles = [
    { number: 'MH-01-AB-1234', type: 'Bus', capacity: 50, driverName: 'Ramesh Kumar', driverPhone: '+91-9876543211' },
    { number: 'MH-01-CD-5678', type: 'Bus', capacity: 50, driverName: 'Suresh Sharma', driverPhone: '+91-9876543212' },
    { number: 'MH-01-EF-9012', type: 'Van', capacity: 20, driverName: 'Mahesh Patel', driverPhone: '+91-9876543213' },
  ]

  for (const vehicle of vehicles) {
    await prisma.vehicle.upsert({
      where: {
        schoolId_number: {
          schoolId: school.id,
          number: vehicle.number,
        },
      },
      update: {},
      create: {
        schoolId: school.id,
        ...vehicle,
      },
    })
  }
  console.log(`✅ Created ${vehicles.length} vehicles`)

  // Create Hostel
  const hostel = await prisma.hostel.upsert({
    where: {
      schoolId_code: {
        schoolId: school.id,
        code: 'BH1',
      },
    },
    update: {},
    create: {
      schoolId: school.id,
      name: 'Boys Hostel',
      code: 'BH1',
      warden: 'Mr. Anil Verma',
      phone: '+91-9876543220',
      capacity: 100,
    },
  })

  // Add floors and rooms
  for (let floorNum = 1; floorNum <= 3; floorNum++) {
    let floor = await prisma.hostelFloor.findFirst({
      where: {
        hostelId: hostel.id,
        number: floorNum,
      },
    })
    if (!floor) {
      floor = await prisma.hostelFloor.create({
        data: {
          hostelId: hostel.id,
          name: `Floor ${floorNum}`,
          number: floorNum,
        },
      })
    }

    // Add 10 rooms per floor
    for (let roomNum = 1; roomNum <= 10; roomNum++) {
      const roomNumber = `${floorNum}0${roomNum}`
      let room = await prisma.hostelRoom.findFirst({
        where: {
          floorId: floor.id,
          number: roomNumber,
        },
      })
      if (!room) {
        room = await prisma.hostelRoom.create({
          data: {
            floorId: floor.id,
            number: roomNumber,
            capacity: 4,
            type: 'Shared',
          },
        })
      }

      // Add 4 beds per room
      for (let bedNum = 1; bedNum <= 4; bedNum++) {
        const existingBed = await prisma.hostelBed.findFirst({
          where: {
            roomId: room.id,
            number: `${bedNum}`,
          },
        })
        if (!existingBed) {
          await prisma.hostelBed.create({
            data: {
              roomId: room.id,
              number: `${bedNum}`,
            },
          })
        }
      }
    }
  }
  console.log('✅ Created hostel with floors, rooms, and beds')

  // Create Library
  const library = await prisma.library.upsert({
    where: {
      schoolId_code: {
        schoolId: school.id,
        code: 'LIB001',
      },
    },
    update: {},
    create: {
      schoolId: school.id,
      name: 'Central Library',
      code: 'LIB001',
      location: 'Ground Floor, Main Building',
    },
  })

  // Add some books
  const books = [
    { title: 'To Kill a Mockingbird', author: 'Harper Lee', isbn: '9780061120084', category: 'Fiction', quantity: 5 },
    { title: '1984', author: 'George Orwell', isbn: '9780451524935', category: 'Fiction', quantity: 5 },
    { title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', isbn: '9780743273565', category: 'Fiction', quantity: 5 },
    { title: 'Pride and Prejudice', author: 'Jane Austen', isbn: '9780141439518', category: 'Fiction', quantity: 5 },
    { title: 'Mathematics Grade 10', author: 'NCERT', category: 'Textbook', quantity: 50 },
    { title: 'Science Grade 10', author: 'NCERT', category: 'Textbook', quantity: 50 },
  ]

  for (const book of books) {
    const existingBook = await prisma.book.findFirst({
      where: {
        libraryId: library.id,
        title: book.title,
        author: book.author,
      },
    })
    if (!existingBook) {
      await prisma.book.create({
        data: {
          libraryId: library.id,
          ...book,
          available: book.quantity,
          price: 500,
          purchaseDate: new Date(),
        },
      })
    }
  }
  console.log(`✅ Created library with ${books.length} books`)

  // Create sample students
  const sampleStudents = [
    {
      admissionNumber: 'STU001',
      firstName: 'Rahul',
      lastName: 'Sharma',
      gender: 'MALE',
      dateOfBirth: new Date('2010-05-15'),
      phone: '+91-9876543231',
      email: 'rahul.sharma@example.com',
    },
    {
      admissionNumber: 'STU002',
      firstName: 'Priya',
      lastName: 'Patel',
      gender: 'FEMALE',
      dateOfBirth: new Date('2010-08-22'),
      phone: '+91-9876543232',
      email: 'priya.patel@example.com',
    },
    {
      admissionNumber: 'STU003',
      firstName: 'Amit',
      lastName: 'Kumar',
      gender: 'MALE',
      dateOfBirth: new Date('2010-03-10'),
      phone: '+91-9876543233',
      email: 'amit.kumar@example.com',
    },
  ]

  for (const studentData of sampleStudents) {
    const student = await prisma.student.upsert({
      where: {
        schoolId_admissionNumber: {
          schoolId: school.id,
          admissionNumber: studentData.admissionNumber,
        },
      },
      update: {},
      create: {
        ...studentData,
        schoolId: school.id,
        branchId: branch.id,
        classId: classes[4].id, // Class 5
        admissionDate: new Date('2024-04-01'),
        bloodGroup: 'O_POSITIVE',
        nationality: 'Indian',
        address: 'Sample Address',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
      },
    })

    // Add guardian (check if already exists)
    const existingGuardian = await prisma.guardian.findFirst({
      where: {
        studentId: student.id,
        isPrimary: true,
      },
    })

    if (!existingGuardian) {
      await prisma.guardian.create({
        data: {
          studentId: student.id,
          relation: 'Father',
          firstName: studentData.firstName + "'s",
          lastName: 'Parent',
          phone: studentData.phone,
          email: 'parent.' + studentData.email,
          occupation: 'Business',
          isPrimary: true,
        },
      })
    }
  }
  console.log(`✅ Created ${sampleStudents.length} sample students`)

  console.log('✨ Seeding completed successfully!')
  console.log('\n📝 Login credentials:')
  console.log('   Email: admin@school.com')
  console.log('   Password: admin123')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
