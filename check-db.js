const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function checkDatabase() {
  console.log('🔍 Checking database connection...\n')

  try {
    // Try to connect
    await prisma.$connect()
    console.log('✅ Database connection successful!\n')

    // Check if tables exist
    const schoolCount = await prisma.school.count()
    console.log(`📊 Found ${schoolCount} school(s) in database`)

    const userCount = await prisma.user.count()
    console.log(`👥 Found ${userCount} user(s) in database\n`)

    if (schoolCount === 0) {
      console.log('💡 Tip: Run "pnpm db:seed" to create initial data\n')
    } else {
      // Check for admin user
      const adminUser = await prisma.user.findFirst({
        where: { email: 'admin@school.com' }
      })

      if (adminUser) {
        console.log('✅ Admin user exists!')
        console.log('   Email: admin@school.com')
        console.log('   Password: admin123\n')
      } else {
        console.log('⚠️  Admin user not found. Run "pnpm db:seed"\n')
      }
    }

    console.log('🚀 Ready to start! Run "pnpm dev"\n')

  } catch (error) {
    console.error('❌ Database connection failed!\n')

    if (error.code === 'P1001') {
      console.error('💡 PostgreSQL is not running or not accessible')
      console.error('   • Check if PostgreSQL service is started')
      console.error('   • Verify DATABASE_URL in .env file')
      console.error('   • Run: brew services start postgresql (macOS)')
      console.error('   • Run: sudo service postgresql start (Linux)\n')
    } else if (error.code === 'P1003') {
      console.error('💡 Database "edu_erp" does not exist')
      console.error('   • Run: createdb edu_erp')
      console.error('   • Or: psql -U postgres -c "CREATE DATABASE edu_erp;"\n')
    } else {
      console.error('Error:', error.message, '\n')
    }

    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

checkDatabase()
