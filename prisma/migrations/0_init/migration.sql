-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'HEAD_TEACHER', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'TRANSPORT_MANAGER', 'HOSTEL_WARDEN', 'RECEPTIONIST', 'STUDENT', 'PARENT');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "BloodGroup" AS ENUM ('A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE');

-- CreateEnum
CREATE TYPE "StaffType" AS ENUM ('TEACHING', 'NON_TEACHING', 'ADMINISTRATIVE', 'SUPPORT');

-- CreateEnum
CREATE TYPE "AdmissionStatus" AS ENUM ('INQUIRY', 'PROSPECT', 'TEST_SCHEDULED', 'TEST_COMPLETED', 'INTERVIEW_SCHEDULED', 'APPROVED', 'REJECTED', 'WAITLISTED', 'ADMITTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('ISSUED', 'RETURNED', 'OVERDUE', 'LOST', 'DAMAGED');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('FURNITURE', 'EQUIPMENT', 'ELECTRONICS', 'VEHICLES', 'BOOKS', 'SPORTS', 'OTHER');

-- CreateEnum
CREATE TYPE "FeeType" AS ENUM ('TUITION', 'ADMISSION', 'EXAMINATION', 'TRANSPORT', 'HOSTEL', 'LIBRARY', 'SPORTS', 'LABORATORY', 'UNIFORM', 'BOOKS', 'OTHER');

-- CreateEnum
CREATE TYPE "FeeFrequency" AS ENUM ('ONE_TIME', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'PARTIAL', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('CASH', 'CHEQUE', 'CARD', 'UPI', 'NET_BANKING', 'OTHER');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('CREDIT', 'DEBIT', 'REFUND');

-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('UNIFORM', 'BOOKS', 'STATIONERY', 'SPORTS', 'OTHER');

-- CreateEnum
CREATE TYPE "MarketplaceOrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "schools" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "pincode" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "logo" TEXT,
    "principalName" TEXT,
    "established" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic_years" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classes" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT,
    "academicYearId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 30,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sections" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 40,
    "teacherId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_custom_roles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_custom_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT,
    "admissionNumber" TEXT NOT NULL,
    "rollNumber" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "gender" "Gender" NOT NULL,
    "bloodGroup" "BloodGroup",
    "photo" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "nationality" TEXT,
    "religion" TEXT,
    "caste" TEXT,
    "motherTongue" TEXT,
    "previousSchool" TEXT,
    "medicalInfo" JSONB,
    "documents" JSONB,
    "customFields" JSONB,
    "admissionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guardians" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "occupation" TEXT,
    "address" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,

    CONSTRAINT "guardians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_siblings" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "siblingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_siblings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT,
    "employeeId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "gender" "Gender" NOT NULL,
    "bloodGroup" "BloodGroup",
    "photo" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "staffType" "StaffType" NOT NULL,
    "designation" TEXT NOT NULL,
    "department" TEXT,
    "qualification" TEXT,
    "experience" INTEGER,
    "joiningDate" TIMESTAMP(3) NOT NULL,
    "salary" DOUBLE PRECISION,
    "bankDetails" JSONB,
    "documents" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admissions" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "studentId" TEXT,
    "inquiryNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "gender" "Gender" NOT NULL,
    "parentName" TEXT NOT NULL,
    "parentPhone" TEXT NOT NULL,
    "parentEmail" TEXT,
    "address" TEXT,
    "previousSchool" TEXT,
    "appliedClass" TEXT NOT NULL,
    "status" "AdmissionStatus" NOT NULL DEFAULT 'INQUIRY',
    "testDate" TIMESTAMP(3),
    "testScore" DOUBLE PRECISION,
    "interviewDate" TIMESTAMP(3),
    "interviewNotes" TEXT,
    "approvedBy" TEXT,
    "approvalDate" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "documents" JSONB,
    "notes" TEXT,
    "followUpDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routes" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stops" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "arrivalTime" TEXT,
    "sequence" INTEGER NOT NULL,
    "fare" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "routeId" TEXT,
    "number" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "driverName" TEXT,
    "driverPhone" TEXT,
    "driverLicense" TEXT,
    "insurance" TEXT,
    "registrationNo" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_transport" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "stopId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_transport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hostels" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT,
    "warden" TEXT,
    "phone" TEXT,
    "capacity" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hostels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hostel_floors" (
    "id" TEXT NOT NULL,
    "hostelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hostel_floors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hostel_rooms" (
    "id" TEXT NOT NULL,
    "floorId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "type" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hostel_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hostel_beds" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "isOccupied" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hostel_beds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_hostel" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "hostelId" TEXT NOT NULL,
    "bedId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "messPlan" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_hostel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "libraries" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "location" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "libraries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "books" (
    "id" TEXT NOT NULL,
    "libraryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "isbn" TEXT,
    "barcode" TEXT,
    "category" TEXT,
    "publisher" TEXT,
    "edition" TEXT,
    "pages" INTEGER,
    "language" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "available" INTEGER NOT NULL DEFAULT 1,
    "price" DOUBLE PRECISION,
    "purchaseDate" TIMESTAMP(3),
    "location" TEXT,
    "description" TEXT,
    "coverImage" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "library_issues" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "returnDate" TIMESTAMP(3),
    "status" "IssueStatus" NOT NULL DEFAULT 'ISSUED',
    "fine" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "library_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "gst" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "approvalDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_items" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "assetType" "AssetType" NOT NULL,
    "description" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "purchasePrice" DOUBLE PRECISION,
    "currentValue" DOUBLE PRECISION,
    "location" TEXT,
    "condition" TEXT,
    "isDurable" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fees" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT,
    "name" TEXT NOT NULL,
    "type" "FeeType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "frequency" "FeeFrequency" NOT NULL DEFAULT 'ONE_TIME',
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_payments" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "feeId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paymentDate" TIMESTAMP(3),
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMode" "PaymentMode",
    "transactionId" TEXT,
    "receiptNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fee_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "paidTo" TEXT,
    "paymentMode" TEXT,
    "billNumber" TEXT,
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT,
    "subjectId" TEXT,
    "teacherId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignments" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "maxScore" DOUBLE PRECISION NOT NULL,
    "attachments" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment_submissions" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "content" TEXT,
    "attachments" JSONB,
    "score" DOUBLE PRECISION,
    "feedback" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gradedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignment_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exams" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "examDate" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER,
    "maxScore" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_results" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_cards" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "grades" JSONB NOT NULL,
    "overallScore" DOUBLE PRECISION,
    "remarks" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "targetRole" TEXT,
    "targetClass" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "attachments" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "subject" TEXT,
    "content" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'INFO',
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "organizer" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_items" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canteen_orders" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveryTime" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "canteen_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canteen_order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canteen_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "smart_wallets" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "smart_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "reference" TEXT,
    "balanceBefore" DOUBLE PRECISION NOT NULL,
    "balanceAfter" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "ProductCategory" NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_orders" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "status" "MarketplaceOrderStatus" NOT NULL DEFAULT 'PENDING',
    "shippingAddress" TEXT,
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveryDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_attendance" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "checkIn" TIMESTAMP(3),
    "checkOut" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PRESENT',
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "leaveType" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "approvalDate" TIMESTAMP(3),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "basicSalary" DOUBLE PRECISION NOT NULL,
    "allowances" JSONB,
    "deductions" JSONB,
    "netSalary" DOUBLE PRECISION NOT NULL,
    "paymentDate" TIMESTAMP(3),
    "paymentMode" TEXT,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gps_tracking" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "speed" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gps_tracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport_alerts" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transport_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "changes" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_backups" (
    "id" TEXT NOT NULL,
    "backupType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" DOUBLE PRECISION,
    "location" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_backups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_records" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "complianceType" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3),
    "documents" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "online_classes" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "courseId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "scheduledTime" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER,
    "meetingLink" TEXT,
    "recordingLink" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "online_classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_attendance" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PRESENT',
    "remarks" TEXT,
    "markedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drivers" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "licenseExpiry" TIMESTAMP(3),
    "experience" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "schools_code_key" ON "schools"("code");

-- CreateIndex
CREATE INDEX "schools_isActive_idx" ON "schools"("isActive");

-- CreateIndex
CREATE INDEX "schools_createdAt_idx" ON "schools"("createdAt");

-- CreateIndex
CREATE INDEX "branches_schoolId_idx" ON "branches"("schoolId");

-- CreateIndex
CREATE INDEX "branches_isActive_idx" ON "branches"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "branches_schoolId_code_key" ON "branches"("schoolId", "code");

-- CreateIndex
CREATE INDEX "academic_years_schoolId_idx" ON "academic_years"("schoolId");

-- CreateIndex
CREATE INDEX "academic_years_isCurrent_idx" ON "academic_years"("isCurrent");

-- CreateIndex
CREATE UNIQUE INDEX "academic_years_schoolId_name_key" ON "academic_years"("schoolId", "name");

-- CreateIndex
CREATE INDEX "classes_schoolId_idx" ON "classes"("schoolId");

-- CreateIndex
CREATE INDEX "classes_branchId_idx" ON "classes"("branchId");

-- CreateIndex
CREATE INDEX "classes_academicYearId_idx" ON "classes"("academicYearId");

-- CreateIndex
CREATE INDEX "classes_schoolId_isActive_idx" ON "classes"("schoolId", "isActive");

-- CreateIndex
CREATE INDEX "classes_grade_idx" ON "classes"("grade");

-- CreateIndex
CREATE UNIQUE INDEX "classes_schoolId_academicYearId_name_key" ON "classes"("schoolId", "academicYearId", "name");

-- CreateIndex
CREATE INDEX "sections_classId_idx" ON "sections"("classId");

-- CreateIndex
CREATE INDEX "sections_teacherId_idx" ON "sections"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "sections_classId_name_key" ON "sections"("classId", "name");

-- CreateIndex
CREATE INDEX "subjects_schoolId_idx" ON "subjects"("schoolId");

-- CreateIndex
CREATE INDEX "subjects_classId_idx" ON "subjects"("classId");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_schoolId_code_key" ON "subjects"("schoolId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_schoolId_idx" ON "users"("schoolId");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_schoolId_role_isActive_idx" ON "users"("schoolId", "role", "isActive");

-- CreateIndex
CREATE INDEX "roles_schoolId_idx" ON "roles"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_schoolId_name_key" ON "roles"("schoolId", "name");

-- CreateIndex
CREATE INDEX "user_custom_roles_userId_idx" ON "user_custom_roles"("userId");

-- CreateIndex
CREATE INDEX "user_custom_roles_roleId_idx" ON "user_custom_roles"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "user_custom_roles_userId_roleId_key" ON "user_custom_roles"("userId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "students_userId_key" ON "students"("userId");

-- CreateIndex
CREATE INDEX "students_schoolId_idx" ON "students"("schoolId");

-- CreateIndex
CREATE INDEX "students_branchId_idx" ON "students"("branchId");

-- CreateIndex
CREATE INDEX "students_classId_idx" ON "students"("classId");

-- CreateIndex
CREATE INDEX "students_sectionId_idx" ON "students"("sectionId");

-- CreateIndex
CREATE INDEX "students_schoolId_isActive_idx" ON "students"("schoolId", "isActive");

-- CreateIndex
CREATE INDEX "students_schoolId_classId_isActive_idx" ON "students"("schoolId", "classId", "isActive");

-- CreateIndex
CREATE INDEX "students_admissionNumber_idx" ON "students"("admissionNumber");

-- CreateIndex
CREATE INDEX "students_email_idx" ON "students"("email");

-- CreateIndex
CREATE INDEX "students_phone_idx" ON "students"("phone");

-- CreateIndex
CREATE INDEX "students_createdAt_idx" ON "students"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "students_schoolId_admissionNumber_key" ON "students"("schoolId", "admissionNumber");

-- CreateIndex
CREATE INDEX "guardians_userId_idx" ON "guardians"("userId");

-- CreateIndex
CREATE INDEX "guardians_studentId_idx" ON "guardians"("studentId");

-- CreateIndex
CREATE INDEX "guardians_phone_idx" ON "guardians"("phone");

-- CreateIndex
CREATE INDEX "guardians_email_idx" ON "guardians"("email");

-- CreateIndex
CREATE INDEX "student_siblings_studentId_idx" ON "student_siblings"("studentId");

-- CreateIndex
CREATE INDEX "student_siblings_siblingId_idx" ON "student_siblings"("siblingId");

-- CreateIndex
CREATE UNIQUE INDEX "student_siblings_studentId_siblingId_key" ON "student_siblings"("studentId", "siblingId");

-- CreateIndex
CREATE INDEX "staff_schoolId_idx" ON "staff"("schoolId");

-- CreateIndex
CREATE INDEX "staff_branchId_idx" ON "staff"("branchId");

-- CreateIndex
CREATE INDEX "staff_email_idx" ON "staff"("email");

-- CreateIndex
CREATE INDEX "staff_employeeId_idx" ON "staff"("employeeId");

-- CreateIndex
CREATE INDEX "staff_schoolId_isActive_idx" ON "staff"("schoolId", "isActive");

-- CreateIndex
CREATE INDEX "staff_staffType_isActive_idx" ON "staff"("staffType", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "staff_schoolId_employeeId_key" ON "staff"("schoolId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "admissions_studentId_key" ON "admissions"("studentId");

-- CreateIndex
CREATE INDEX "admissions_schoolId_idx" ON "admissions"("schoolId");

-- CreateIndex
CREATE INDEX "admissions_academicYearId_idx" ON "admissions"("academicYearId");

-- CreateIndex
CREATE INDEX "admissions_status_idx" ON "admissions"("status");

-- CreateIndex
CREATE INDEX "admissions_schoolId_status_idx" ON "admissions"("schoolId", "status");

-- CreateIndex
CREATE INDEX "admissions_createdAt_idx" ON "admissions"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "admissions_schoolId_inquiryNumber_key" ON "admissions"("schoolId", "inquiryNumber");

-- CreateIndex
CREATE INDEX "routes_schoolId_idx" ON "routes"("schoolId");

-- CreateIndex
CREATE INDEX "routes_isActive_idx" ON "routes"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "routes_schoolId_code_key" ON "routes"("schoolId", "code");

-- CreateIndex
CREATE INDEX "stops_routeId_idx" ON "stops"("routeId");

-- CreateIndex
CREATE INDEX "stops_sequence_idx" ON "stops"("sequence");

-- CreateIndex
CREATE INDEX "vehicles_schoolId_idx" ON "vehicles"("schoolId");

-- CreateIndex
CREATE INDEX "vehicles_routeId_idx" ON "vehicles"("routeId");

-- CreateIndex
CREATE INDEX "vehicles_isActive_idx" ON "vehicles"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_schoolId_number_key" ON "vehicles"("schoolId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "student_transport_studentId_key" ON "student_transport"("studentId");

-- CreateIndex
CREATE INDEX "student_transport_routeId_idx" ON "student_transport"("routeId");

-- CreateIndex
CREATE INDEX "student_transport_stopId_idx" ON "student_transport"("stopId");

-- CreateIndex
CREATE INDEX "student_transport_isActive_idx" ON "student_transport"("isActive");

-- CreateIndex
CREATE INDEX "hostels_schoolId_idx" ON "hostels"("schoolId");

-- CreateIndex
CREATE INDEX "hostels_isActive_idx" ON "hostels"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "hostels_schoolId_code_key" ON "hostels"("schoolId", "code");

-- CreateIndex
CREATE INDEX "hostel_floors_hostelId_idx" ON "hostel_floors"("hostelId");

-- CreateIndex
CREATE INDEX "hostel_rooms_floorId_idx" ON "hostel_rooms"("floorId");

-- CreateIndex
CREATE INDEX "hostel_beds_roomId_idx" ON "hostel_beds"("roomId");

-- CreateIndex
CREATE INDEX "hostel_beds_isOccupied_idx" ON "hostel_beds"("isOccupied");

-- CreateIndex
CREATE UNIQUE INDEX "student_hostel_studentId_key" ON "student_hostel"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "student_hostel_bedId_key" ON "student_hostel"("bedId");

-- CreateIndex
CREATE INDEX "student_hostel_hostelId_idx" ON "student_hostel"("hostelId");

-- CreateIndex
CREATE INDEX "student_hostel_bedId_idx" ON "student_hostel"("bedId");

-- CreateIndex
CREATE INDEX "student_hostel_isActive_idx" ON "student_hostel"("isActive");

-- CreateIndex
CREATE INDEX "libraries_schoolId_idx" ON "libraries"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "libraries_schoolId_code_key" ON "libraries"("schoolId", "code");

-- CreateIndex
CREATE INDEX "books_libraryId_idx" ON "books"("libraryId");

-- CreateIndex
CREATE INDEX "books_isbn_idx" ON "books"("isbn");

-- CreateIndex
CREATE INDEX "books_barcode_idx" ON "books"("barcode");

-- CreateIndex
CREATE INDEX "books_category_idx" ON "books"("category");

-- CreateIndex
CREATE INDEX "books_isActive_idx" ON "books"("isActive");

-- CreateIndex
CREATE INDEX "library_issues_bookId_idx" ON "library_issues"("bookId");

-- CreateIndex
CREATE INDEX "library_issues_studentId_idx" ON "library_issues"("studentId");

-- CreateIndex
CREATE INDEX "library_issues_status_idx" ON "library_issues"("status");

-- CreateIndex
CREATE INDEX "library_issues_dueDate_idx" ON "library_issues"("dueDate");

-- CreateIndex
CREATE INDEX "library_issues_status_dueDate_idx" ON "library_issues"("status", "dueDate");

-- CreateIndex
CREATE INDEX "library_issues_studentId_status_idx" ON "library_issues"("studentId", "status");

-- CreateIndex
CREATE INDEX "vendors_schoolId_idx" ON "vendors"("schoolId");

-- CreateIndex
CREATE INDEX "vendors_isActive_idx" ON "vendors"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_schoolId_code_key" ON "vendors"("schoolId", "code");

-- CreateIndex
CREATE INDEX "purchase_orders_schoolId_idx" ON "purchase_orders"("schoolId");

-- CreateIndex
CREATE INDEX "purchase_orders_vendorId_idx" ON "purchase_orders"("vendorId");

-- CreateIndex
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders"("status");

-- CreateIndex
CREATE INDEX "purchase_orders_orderDate_idx" ON "purchase_orders"("orderDate");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_schoolId_orderNumber_key" ON "purchase_orders"("schoolId", "orderNumber");

-- CreateIndex
CREATE INDEX "purchase_order_items_purchaseOrderId_idx" ON "purchase_order_items"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "assets_schoolId_idx" ON "assets"("schoolId");

-- CreateIndex
CREATE INDEX "assets_assetType_idx" ON "assets"("assetType");

-- CreateIndex
CREATE INDEX "assets_isActive_idx" ON "assets"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "assets_schoolId_code_key" ON "assets"("schoolId", "code");

-- CreateIndex
CREATE INDEX "fees_schoolId_idx" ON "fees"("schoolId");

-- CreateIndex
CREATE INDEX "fees_classId_idx" ON "fees"("classId");

-- CreateIndex
CREATE INDEX "fees_type_idx" ON "fees"("type");

-- CreateIndex
CREATE INDEX "fees_isActive_idx" ON "fees"("isActive");

-- CreateIndex
CREATE INDEX "fee_payments_schoolId_idx" ON "fee_payments"("schoolId");

-- CreateIndex
CREATE INDEX "fee_payments_studentId_idx" ON "fee_payments"("studentId");

-- CreateIndex
CREATE INDEX "fee_payments_feeId_idx" ON "fee_payments"("feeId");

-- CreateIndex
CREATE INDEX "fee_payments_status_idx" ON "fee_payments"("status");

-- CreateIndex
CREATE INDEX "fee_payments_dueDate_idx" ON "fee_payments"("dueDate");

-- CreateIndex
CREATE INDEX "fee_payments_schoolId_status_idx" ON "fee_payments"("schoolId", "status");

-- CreateIndex
CREATE INDEX "fee_payments_studentId_status_idx" ON "fee_payments"("studentId", "status");

-- CreateIndex
CREATE INDEX "fee_payments_status_dueDate_idx" ON "fee_payments"("status", "dueDate");

-- CreateIndex
CREATE INDEX "fee_payments_paymentDate_idx" ON "fee_payments"("paymentDate");

-- CreateIndex
CREATE INDEX "fee_payments_receiptNumber_idx" ON "fee_payments"("receiptNumber");

-- CreateIndex
CREATE INDEX "expenses_schoolId_idx" ON "expenses"("schoolId");

-- CreateIndex
CREATE INDEX "expenses_category_idx" ON "expenses"("category");

-- CreateIndex
CREATE INDEX "expenses_date_idx" ON "expenses"("date");

-- CreateIndex
CREATE INDEX "expenses_schoolId_date_idx" ON "expenses"("schoolId", "date");

-- CreateIndex
CREATE INDEX "courses_schoolId_idx" ON "courses"("schoolId");

-- CreateIndex
CREATE INDEX "courses_classId_idx" ON "courses"("classId");

-- CreateIndex
CREATE INDEX "courses_subjectId_idx" ON "courses"("subjectId");

-- CreateIndex
CREATE INDEX "courses_teacherId_idx" ON "courses"("teacherId");

-- CreateIndex
CREATE INDEX "courses_isActive_idx" ON "courses"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "courses_schoolId_code_key" ON "courses"("schoolId", "code");

-- CreateIndex
CREATE INDEX "assignments_courseId_idx" ON "assignments"("courseId");

-- CreateIndex
CREATE INDEX "assignments_dueDate_idx" ON "assignments"("dueDate");

-- CreateIndex
CREATE INDEX "assignments_isActive_idx" ON "assignments"("isActive");

-- CreateIndex
CREATE INDEX "assignment_submissions_assignmentId_idx" ON "assignment_submissions"("assignmentId");

-- CreateIndex
CREATE INDEX "assignment_submissions_studentId_idx" ON "assignment_submissions"("studentId");

-- CreateIndex
CREATE INDEX "assignment_submissions_submittedAt_idx" ON "assignment_submissions"("submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "assignment_submissions_assignmentId_studentId_key" ON "assignment_submissions"("assignmentId", "studentId");

-- CreateIndex
CREATE INDEX "exams_courseId_idx" ON "exams"("courseId");

-- CreateIndex
CREATE INDEX "exams_examDate_idx" ON "exams"("examDate");

-- CreateIndex
CREATE INDEX "exams_isActive_idx" ON "exams"("isActive");

-- CreateIndex
CREATE INDEX "exam_results_examId_idx" ON "exam_results"("examId");

-- CreateIndex
CREATE INDEX "exam_results_studentId_idx" ON "exam_results"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "exam_results_examId_studentId_key" ON "exam_results"("examId", "studentId");

-- CreateIndex
CREATE INDEX "report_cards_studentId_idx" ON "report_cards"("studentId");

-- CreateIndex
CREATE INDEX "report_cards_academicYearId_idx" ON "report_cards"("academicYearId");

-- CreateIndex
CREATE INDEX "report_cards_isPublished_idx" ON "report_cards"("isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "report_cards_studentId_academicYearId_term_key" ON "report_cards"("studentId", "academicYearId", "term");

-- CreateIndex
CREATE INDEX "announcements_schoolId_idx" ON "announcements"("schoolId");

-- CreateIndex
CREATE INDEX "announcements_isActive_idx" ON "announcements"("isActive");

-- CreateIndex
CREATE INDEX "announcements_priority_idx" ON "announcements"("priority");

-- CreateIndex
CREATE INDEX "announcements_publishedAt_idx" ON "announcements"("publishedAt");

-- CreateIndex
CREATE INDEX "announcements_schoolId_isActive_idx" ON "announcements"("schoolId", "isActive");

-- CreateIndex
CREATE INDEX "messages_senderId_idx" ON "messages"("senderId");

-- CreateIndex
CREATE INDEX "messages_receiverId_idx" ON "messages"("receiverId");

-- CreateIndex
CREATE INDEX "messages_receiverId_isRead_idx" ON "messages"("receiverId", "isRead");

-- CreateIndex
CREATE INDEX "messages_senderId_createdAt_idx" ON "messages"("senderId", "createdAt");

-- CreateIndex
CREATE INDEX "messages_createdAt_idx" ON "messages"("createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE INDEX "events_schoolId_idx" ON "events"("schoolId");

-- CreateIndex
CREATE INDEX "events_eventDate_idx" ON "events"("eventDate");

-- CreateIndex
CREATE INDEX "events_isActive_idx" ON "events"("isActive");

-- CreateIndex
CREATE INDEX "menu_items_schoolId_idx" ON "menu_items"("schoolId");

-- CreateIndex
CREATE INDEX "menu_items_category_idx" ON "menu_items"("category");

-- CreateIndex
CREATE INDEX "menu_items_isAvailable_idx" ON "menu_items"("isAvailable");

-- CreateIndex
CREATE INDEX "menu_items_isActive_idx" ON "menu_items"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "canteen_orders_orderNumber_key" ON "canteen_orders"("orderNumber");

-- CreateIndex
CREATE INDEX "canteen_orders_studentId_idx" ON "canteen_orders"("studentId");

-- CreateIndex
CREATE INDEX "canteen_orders_status_idx" ON "canteen_orders"("status");

-- CreateIndex
CREATE INDEX "canteen_orders_orderDate_idx" ON "canteen_orders"("orderDate");

-- CreateIndex
CREATE INDEX "canteen_orders_orderNumber_idx" ON "canteen_orders"("orderNumber");

-- CreateIndex
CREATE INDEX "canteen_order_items_orderId_idx" ON "canteen_order_items"("orderId");

-- CreateIndex
CREATE INDEX "canteen_order_items_menuItemId_idx" ON "canteen_order_items"("menuItemId");

-- CreateIndex
CREATE UNIQUE INDEX "smart_wallets_studentId_key" ON "smart_wallets"("studentId");

-- CreateIndex
CREATE INDEX "smart_wallets_isActive_idx" ON "smart_wallets"("isActive");

-- CreateIndex
CREATE INDEX "wallet_transactions_walletId_idx" ON "wallet_transactions"("walletId");

-- CreateIndex
CREATE INDEX "wallet_transactions_walletId_createdAt_idx" ON "wallet_transactions"("walletId", "createdAt");

-- CreateIndex
CREATE INDEX "wallet_transactions_createdAt_idx" ON "wallet_transactions"("createdAt");

-- CreateIndex
CREATE INDEX "wallet_transactions_type_idx" ON "wallet_transactions"("type");

-- CreateIndex
CREATE INDEX "products_schoolId_idx" ON "products"("schoolId");

-- CreateIndex
CREATE INDEX "products_category_idx" ON "products"("category");

-- CreateIndex
CREATE INDEX "products_isActive_idx" ON "products"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_orders_orderNumber_key" ON "marketplace_orders"("orderNumber");

-- CreateIndex
CREATE INDEX "marketplace_orders_studentId_idx" ON "marketplace_orders"("studentId");

-- CreateIndex
CREATE INDEX "marketplace_orders_status_idx" ON "marketplace_orders"("status");

-- CreateIndex
CREATE INDEX "marketplace_orders_orderDate_idx" ON "marketplace_orders"("orderDate");

-- CreateIndex
CREATE INDEX "marketplace_orders_orderNumber_idx" ON "marketplace_orders"("orderNumber");

-- CreateIndex
CREATE INDEX "marketplace_order_items_orderId_idx" ON "marketplace_order_items"("orderId");

-- CreateIndex
CREATE INDEX "marketplace_order_items_productId_idx" ON "marketplace_order_items"("productId");

-- CreateIndex
CREATE INDEX "staff_attendance_staffId_idx" ON "staff_attendance"("staffId");

-- CreateIndex
CREATE INDEX "staff_attendance_date_idx" ON "staff_attendance"("date");

-- CreateIndex
CREATE INDEX "staff_attendance_staffId_date_idx" ON "staff_attendance"("staffId", "date");

-- CreateIndex
CREATE INDEX "staff_attendance_date_status_idx" ON "staff_attendance"("date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "staff_attendance_staffId_date_key" ON "staff_attendance"("staffId", "date");

-- CreateIndex
CREATE INDEX "leave_requests_staffId_idx" ON "leave_requests"("staffId");

-- CreateIndex
CREATE INDEX "leave_requests_status_idx" ON "leave_requests"("status");

-- CreateIndex
CREATE INDEX "leave_requests_startDate_idx" ON "leave_requests"("startDate");

-- CreateIndex
CREATE INDEX "leave_requests_staffId_status_idx" ON "leave_requests"("staffId", "status");

-- CreateIndex
CREATE INDEX "payroll_staffId_idx" ON "payroll"("staffId");

-- CreateIndex
CREATE INDEX "payroll_isPaid_idx" ON "payroll"("isPaid");

-- CreateIndex
CREATE INDEX "payroll_staffId_year_month_idx" ON "payroll"("staffId", "year", "month");

-- CreateIndex
CREATE INDEX "payroll_isPaid_month_year_idx" ON "payroll"("isPaid", "month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_staffId_month_year_key" ON "payroll"("staffId", "month", "year");

-- CreateIndex
CREATE INDEX "gps_tracking_vehicleId_idx" ON "gps_tracking"("vehicleId");

-- CreateIndex
CREATE INDEX "gps_tracking_timestamp_idx" ON "gps_tracking"("timestamp");

-- CreateIndex
CREATE INDEX "gps_tracking_vehicleId_timestamp_idx" ON "gps_tracking"("vehicleId", "timestamp");

-- CreateIndex
CREATE INDEX "transport_alerts_vehicleId_idx" ON "transport_alerts"("vehicleId");

-- CreateIndex
CREATE INDEX "transport_alerts_isResolved_idx" ON "transport_alerts"("isResolved");

-- CreateIndex
CREATE INDEX "transport_alerts_severity_idx" ON "transport_alerts"("severity");

-- CreateIndex
CREATE INDEX "transport_alerts_vehicleId_isResolved_idx" ON "transport_alerts"("vehicleId", "isResolved");

-- CreateIndex
CREATE INDEX "transport_alerts_createdAt_idx" ON "transport_alerts"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs"("entity");

-- CreateIndex
CREATE INDEX "audit_logs_entityId_idx" ON "audit_logs"("entityId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_entity_createdAt_idx" ON "audit_logs"("entity", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "data_backups_status_idx" ON "data_backups"("status");

-- CreateIndex
CREATE INDEX "data_backups_createdAt_idx" ON "data_backups"("createdAt");

-- CreateIndex
CREATE INDEX "compliance_records_schoolId_idx" ON "compliance_records"("schoolId");

-- CreateIndex
CREATE INDEX "compliance_records_complianceType_idx" ON "compliance_records"("complianceType");

-- CreateIndex
CREATE INDEX "compliance_records_status_idx" ON "compliance_records"("status");

-- CreateIndex
CREATE INDEX "compliance_records_isActive_idx" ON "compliance_records"("isActive");

-- CreateIndex
CREATE INDEX "online_classes_schoolId_idx" ON "online_classes"("schoolId");

-- CreateIndex
CREATE INDEX "online_classes_courseId_idx" ON "online_classes"("courseId");

-- CreateIndex
CREATE INDEX "online_classes_scheduledTime_idx" ON "online_classes"("scheduledTime");

-- CreateIndex
CREATE INDEX "student_attendance_schoolId_date_idx" ON "student_attendance"("schoolId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "student_attendance_studentId_date_key" ON "student_attendance"("studentId", "date");

-- CreateIndex
CREATE INDEX "drivers_schoolId_idx" ON "drivers"("schoolId");

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_years" ADD CONSTRAINT "academic_years_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_custom_roles" ADD CONSTRAINT "user_custom_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_custom_roles" ADD CONSTRAINT "user_custom_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardians" ADD CONSTRAINT "guardians_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardians" ADD CONSTRAINT "guardians_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_siblings" ADD CONSTRAINT "student_siblings_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_siblings" ADD CONSTRAINT "student_siblings_siblingId_fkey" FOREIGN KEY ("siblingId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stops" ADD CONSTRAINT "stops_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_transport" ADD CONSTRAINT "student_transport_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_transport" ADD CONSTRAINT "student_transport_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_transport" ADD CONSTRAINT "student_transport_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "stops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hostels" ADD CONSTRAINT "hostels_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hostel_floors" ADD CONSTRAINT "hostel_floors_hostelId_fkey" FOREIGN KEY ("hostelId") REFERENCES "hostels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hostel_rooms" ADD CONSTRAINT "hostel_rooms_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "hostel_floors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hostel_beds" ADD CONSTRAINT "hostel_beds_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "hostel_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_hostel" ADD CONSTRAINT "student_hostel_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_hostel" ADD CONSTRAINT "student_hostel_hostelId_fkey" FOREIGN KEY ("hostelId") REFERENCES "hostels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_hostel" ADD CONSTRAINT "student_hostel_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "hostel_beds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "libraries" ADD CONSTRAINT "libraries_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "books" ADD CONSTRAINT "books_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "libraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_issues" ADD CONSTRAINT "library_issues_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_issues" ADD CONSTRAINT "library_issues_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fees" ADD CONSTRAINT "fees_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fees" ADD CONSTRAINT "fees_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_feeId_fkey" FOREIGN KEY ("feeId") REFERENCES "fees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_results" ADD CONSTRAINT "exam_results_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_results" ADD CONSTRAINT "exam_results_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canteen_orders" ADD CONSTRAINT "canteen_orders_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canteen_order_items" ADD CONSTRAINT "canteen_order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "canteen_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canteen_order_items" ADD CONSTRAINT "canteen_order_items_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "smart_wallets" ADD CONSTRAINT "smart_wallets_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "smart_wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_orders" ADD CONSTRAINT "marketplace_orders_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_order_items" ADD CONSTRAINT "marketplace_order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "marketplace_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_order_items" ADD CONSTRAINT "marketplace_order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_attendance" ADD CONSTRAINT "staff_attendance_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll" ADD CONSTRAINT "payroll_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gps_tracking" ADD CONSTRAINT "gps_tracking_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_alerts" ADD CONSTRAINT "transport_alerts_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_records" ADD CONSTRAINT "compliance_records_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "online_classes" ADD CONSTRAINT "online_classes_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "online_classes" ADD CONSTRAINT "online_classes_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_attendance" ADD CONSTRAINT "student_attendance_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_attendance" ADD CONSTRAINT "student_attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

