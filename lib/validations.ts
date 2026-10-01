import { z } from 'zod'

// Common validations
const requiredString = z.string().min(1, 'This field is required')
const optionalString = z.string().optional().nullable()
const email = z.string().email('Invalid email address')
const optionalEmail = z.string().email('Invalid email address').optional().nullable().or(z.literal(''))
const phone = z.string().regex(/^[\d\s\-+()]+$/, 'Invalid phone number').optional().nullable().or(z.literal(''))
const requiredPhone = z.string().regex(/^[\d\s\-+()]+$/, 'Invalid phone number')
const positiveNumber = z.number().positive('Must be a positive number')
const nonNegativeNumber = z.number().min(0, 'Cannot be negative')
const dateString = z.string().refine((val) => !val || !isNaN(Date.parse(val)), 'Invalid date')

// Enums from Prisma - FIXED to match Prisma schema exactly
const Gender = z.enum(['MALE', 'FEMALE', 'OTHER'])
const BloodGroup = z.enum(['A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE'])
const StaffType = z.enum(['TEACHING', 'NON_TEACHING', 'ADMINISTRATIVE', 'SUPPORT'])
const FeeType = z.enum(['TUITION', 'ADMISSION', 'EXAMINATION', 'TRANSPORT', 'HOSTEL', 'LIBRARY', 'SPORTS', 'LABORATORY', 'UNIFORM', 'BOOKS', 'OTHER'])
const FeeFrequency = z.enum(['ONE_TIME', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY'])
const PaymentStatus = z.enum(['PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED'])
// FIXED: PaymentMode - changed BANK_TRANSFER to NET_BANKING, added OTHER
const PaymentMode = z.enum(['CASH', 'CHEQUE', 'CARD', 'UPI', 'NET_BANKING', 'OTHER'])
const AdmissionStatus = z.enum(['INQUIRY', 'PROSPECT', 'TEST_SCHEDULED', 'TEST_COMPLETED', 'INTERVIEW_SCHEDULED', 'APPROVED', 'REJECTED', 'WAITLISTED', 'ADMITTED', 'CANCELLED'])
const AssetType = z.enum(['FURNITURE', 'EQUIPMENT', 'ELECTRONICS', 'VEHICLES', 'BOOKS', 'SPORTS', 'OTHER'])
const IssueStatus = z.enum(['ISSUED', 'RETURNED', 'OVERDUE', 'LOST', 'DAMAGED'])
// FIXED: OrderStatus - added CONFIRMED
const OrderStatus = z.enum(['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED'])
const MarketplaceOrderStatus = z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'])
const LeaveStatus = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'])
// FIXED: TransactionType - added REFUND
const TransactionType = z.enum(['CREDIT', 'DEBIT', 'REFUND'])
const ProductCategory = z.enum(['UNIFORM', 'BOOKS', 'STATIONERY', 'SPORTS', 'OTHER'])
const UserRole = z.enum(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'HEAD_TEACHER', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'TRANSPORT_MANAGER', 'HOSTEL_WARDEN', 'RECEPTIONIST', 'PARENT', 'STUDENT'])
// FIXED: PurchaseOrderStatus - changed SUBMITTED to PENDING, DELIVERED to COMPLETED
const PurchaseOrderStatus = z.enum(['DRAFT', 'PENDING', 'APPROVED', 'COMPLETED', 'CANCELLED'])

// ============ SCHOOL & BRANCH ============
export const schoolSchema = z.object({
  name: requiredString.max(200),
  code: requiredString.max(50),
  address: optionalString,
  city: optionalString,
  state: optionalString,
  country: optionalString,
  pincode: optionalString,
  phone: phone,
  email: optionalEmail,
  website: optionalString,
  logo: optionalString,
  principalName: optionalString,
  established: dateString.optional(),
  isActive: z.boolean().default(true),
})

export const branchSchema = z.object({
  name: requiredString.max(200),
  code: requiredString.max(50),
  schoolId: requiredString,
  address: optionalString,
  city: optionalString, // FIXED: Added to match Prisma
  state: optionalString, // FIXED: Added to match Prisma
  phone: phone,
  email: optionalEmail,
  isActive: z.boolean().default(true),
})

// ============ ACADEMIC ============
export const academicYearSchema = z.object({
  name: requiredString.max(100),
  schoolId: requiredString,
  startDate: dateString,
  endDate: dateString,
  isCurrent: z.boolean().default(false),
})

export const classSchema = z.object({
  name: requiredString.max(100),
  grade: z.number().int().min(1).max(12),
  schoolId: requiredString,
  branchId: optionalString,
  academicYearId: requiredString,
  capacity: nonNegativeNumber.int().default(30),
  description: optionalString,
  isActive: z.boolean().default(true),
})

export const sectionSchema = z.object({
  name: requiredString.max(50),
  classId: requiredString,
  teacherId: optionalString,
  capacity: nonNegativeNumber.int().default(40),
  isActive: z.boolean().default(true),
})

export const subjectSchema = z.object({
  name: requiredString.max(100),
  code: requiredString.max(20),
  schoolId: requiredString,
  classId: optionalString,
  description: optionalString,
  isOptional: z.boolean().default(false), // FIXED: Added to match Prisma
  isActive: z.boolean().default(true),
})

// ============ STUDENT ============
export const studentSchema = z.object({
  firstName: requiredString.max(100),
  lastName: requiredString.max(100),
  email: optionalEmail,
  phone: phone,
  dateOfBirth: dateString,
  gender: Gender,
  bloodGroup: BloodGroup.optional().nullable(),
  nationality: optionalString,
  religion: optionalString,
  address: optionalString,
  schoolId: requiredString,
  branchId: optionalString,
  classId: requiredString,
  sectionId: optionalString,
  rollNumber: optionalString,
  admissionNumber: requiredString.max(50),
  admissionDate: dateString.optional(),
  previousSchool: optionalString,
  medicalInfo: z.record(z.unknown()).optional().nullable(),
  documents: z.record(z.unknown()).optional().nullable(),
  customFields: z.record(z.unknown()).optional().nullable(),
  photo: optionalString,
  isActive: z.boolean().default(true),
})

export const studentUpdateSchema = studentSchema.partial().omit({ schoolId: true, admissionNumber: true })

export const guardianSchema = z.object({
  firstName: requiredString.max(100),
  lastName: requiredString.max(100),
  relation: requiredString.max(50),
  phone: requiredString.regex(/^[\d\s\-+()]+$/, 'Invalid phone number'),
  email: optionalEmail,
  occupation: optionalString,
  address: optionalString,
  isPrimary: z.boolean().default(false),
  studentId: requiredString,
})

export const bulkStudentSchema = z.object({
  students: z.array(studentSchema.extend({
    guardians: z.array(guardianSchema.omit({ studentId: true })).optional(),
  })).min(1, 'At least one student is required').max(500, 'Maximum 500 students per upload'),
})

// ============ STAFF ============
export const staffSchema = z.object({
  firstName: requiredString.max(100),
  lastName: requiredString.max(100),
  email: email.max(255),
  phone: requiredPhone,
  dateOfBirth: dateString,
  gender: Gender,
  bloodGroup: BloodGroup.optional().nullable(),
  photo: optionalString,
  address: optionalString,
  city: optionalString,
  state: optionalString,
  pincode: optionalString,
  schoolId: requiredString,
  branchId: optionalString,
  employeeId: requiredString.max(50),
  staffType: StaffType,
  designation: requiredString,
  department: optionalString,
  joiningDate: dateString,
  qualification: optionalString,
  experience: nonNegativeNumber.int().optional().nullable(),
  salary: nonNegativeNumber.optional().nullable(),
  bankDetails: z.record(z.unknown()).optional().nullable(),
  documents: z.record(z.unknown()).optional().nullable(),
  isActive: z.boolean().default(true),
})

export const staffUpdateSchema = staffSchema.partial().omit({ schoolId: true, employeeId: true })

export const staffAttendanceSchema = z.object({
  staffId: requiredString,
  date: dateString,
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'ON_LEAVE']),
  checkIn: dateString.optional(),
  checkOut: dateString.optional(),
  remarks: optionalString,
})

export const leaveRequestSchema = z.object({
  staffId: requiredString,
  startDate: dateString,
  endDate: dateString,
  reason: requiredString.max(500),
  leaveType: requiredString.max(50),
  status: LeaveStatus.default('PENDING'),
})

// FIXED: payrollSchema - changed paidDate to paymentDate, month to string
export const payrollSchema = z.object({
  staffId: requiredString,
  month: requiredString.max(20), // FIXED: Changed from number to string to match Prisma
  year: z.number().int().min(2000).max(2100),
  basicSalary: positiveNumber,
  allowances: z.record(z.number()).optional(),
  deductions: z.record(z.number()).optional(),
  netSalary: positiveNumber,
  isPaid: z.boolean().default(false),
  paymentDate: dateString.optional(), // FIXED: Changed from paidDate to paymentDate
  paymentMode: optionalString, // Added: Payment mode field
})

// ============ ADMISSIONS ============
export const admissionSchema = z.object({
  inquiryNumber: requiredString.max(50),
  schoolId: requiredString,
  academicYearId: requiredString,
  studentId: optionalString,
  firstName: requiredString.max(100),
  lastName: requiredString.max(100),
  dateOfBirth: dateString, // FIXED: Required in Prisma
  gender: Gender, // FIXED: Required in Prisma
  appliedClass: requiredString,
  previousSchool: optionalString,
  parentName: requiredString.max(200),
  parentPhone: requiredString.regex(/^[\d\s\-+()]+$/, 'Invalid phone number'),
  parentEmail: optionalEmail,
  address: optionalString,
  status: AdmissionStatus.default('INQUIRY'),
  testDate: dateString.optional(),
  testScore: nonNegativeNumber.optional().nullable(),
  interviewDate: dateString.optional(),
  interviewNotes: optionalString,
  approvedBy: optionalString, // FIXED: Added to match Prisma
  approvalDate: dateString.optional(), // FIXED: Added to match Prisma
  rejectionReason: optionalString, // FIXED: Added to match Prisma
  notes: optionalString, // FIXED: Added to match Prisma
  followUpDate: dateString.optional(), // FIXED: Added to match Prisma
  documents: z.record(z.unknown()).optional().nullable(),
})

// ============ FINANCE ============
export const feeSchema = z.object({
  name: requiredString.max(200),
  schoolId: requiredString,
  classId: optionalString,
  type: FeeType,
  amount: positiveNumber,
  frequency: FeeFrequency,
  description: optionalString,
  isActive: z.boolean().default(true),
})

export const feePaymentSchema = z.object({
  studentId: requiredString,
  feeId: requiredString,
  schoolId: requiredString,
  amount: positiveNumber,
  paidAmount: nonNegativeNumber.default(0),
  dueDate: dateString,
  status: PaymentStatus.default('PENDING'),
  paymentDate: dateString.optional(),
  paymentMode: PaymentMode.optional(),
  transactionId: optionalString,
  receiptNumber: optionalString,
  notes: optionalString,
})

export const expenseSchema = z.object({
  schoolId: requiredString,
  category: requiredString.max(100),
  amount: positiveNumber,
  description: optionalString,
  date: dateString,
  paidTo: optionalString,
  paymentMode: optionalString,
  billNumber: optionalString,
  approvedBy: optionalString,
})

// ============ LIBRARY ============
export const bookSchema = z.object({
  title: requiredString.max(300),
  libraryId: requiredString,
  author: optionalString,
  isbn: optionalString,
  publisher: optionalString,
  category: optionalString,
  edition: optionalString,
  language: optionalString,
  pages: nonNegativeNumber.int().optional().nullable(),
  quantity: positiveNumber.int().default(1),
  available: nonNegativeNumber.int().default(1),
  price: nonNegativeNumber.optional().nullable(),
  purchaseDate: dateString.optional(),
  location: optionalString,
  barcode: optionalString,
  description: optionalString,
  coverImage: optionalString,
  isActive: z.boolean().default(true),
})

export const libraryIssueSchema = z.object({
  bookId: requiredString,
  studentId: requiredString,
  issueDate: dateString,
  dueDate: dateString,
  returnDate: dateString.optional(),
  status: IssueStatus.default('ISSUED'),
  fine: nonNegativeNumber.default(0),
  notes: optionalString,
})

// ============ TRANSPORT ============
// FIXED: routeSchema - schoolId is required in Prisma
export const routeSchema = z.object({
  name: requiredString.max(200),
  code: requiredString.max(50),
  schoolId: requiredString, // FIXED: Changed from optional to required
  description: optionalString,
  isActive: z.boolean().default(true),
})

export const stopSchema = z.object({
  name: requiredString.max(200),
  routeId: requiredString,
  location: optionalString,
  arrivalTime: optionalString,
  fare: nonNegativeNumber.default(0),
  sequence: nonNegativeNumber.int().default(0),
  isActive: z.boolean().default(true),
})

// FIXED: vehicleSchema - schoolId is required in Prisma
export const vehicleSchema = z.object({
  schoolId: requiredString, // FIXED: Changed from optional to required
  number: requiredString.max(50),
  registrationNo: optionalString,
  type: requiredString.max(50),
  capacity: positiveNumber.int(),
  routeId: optionalString,
  driverName: optionalString,
  driverPhone: phone,
  driverLicense: optionalString,
  insurance: optionalString,
  isActive: z.boolean().default(true),
})

// FIXED: studentTransportSchema - startDate is required in Prisma
export const studentTransportSchema = z.object({
  studentId: requiredString,
  routeId: requiredString,
  stopId: requiredString,
  startDate: dateString, // FIXED: Required in Prisma
  endDate: dateString.optional(),
  isActive: z.boolean().default(true),
})

export const driverSchema = z.object({
  name: requiredString.max(200),
  schoolId: requiredString,
  licenseNumber: requiredString.max(50),
  phone: phone,
  email: optionalEmail,
  dateOfBirth: dateString.optional(),
  joiningDate: dateString.optional(),
  licenseExpiry: dateString.optional(),
  address: optionalString,
  vehicleId: optionalString,
  isActive: z.boolean().default(true),
})

// FIXED: Renamed to gpsTrackingSchema to match Prisma model name
export const gpsTrackingSchema = z.object({
  vehicleId: requiredString,
  latitude: z.number(),
  longitude: z.number(),
  speed: z.number().optional().nullable(),
  timestamp: dateString.optional(),
  status: optionalString,
})
// Keep old name for backwards compatibility
export const vehicleTrackingSchema = gpsTrackingSchema

// ============ HOSTEL ============
export const hostelSchema = z.object({
  name: requiredString.max(200),
  code: requiredString.max(50),
  schoolId: requiredString,
  address: optionalString,
  warden: optionalString,
  phone: phone,
  capacity: positiveNumber.int(),
  isActive: z.boolean().default(true),
})

// FIXED: hostelFloorSchema - changed floorNumber to number
export const hostelFloorSchema = z.object({
  name: requiredString.max(100),
  hostelId: requiredString,
  number: z.number().int(), // FIXED: Changed from floorNumber to number
  isActive: z.boolean().default(true),
})

// FIXED: hostelRoomSchema - changed roomNumber to number, removed rent
export const hostelRoomSchema = z.object({
  number: requiredString.max(50), // FIXED: Changed from roomNumber to number
  floorId: requiredString,
  capacity: positiveNumber.int(),
  type: optionalString, // Optional in Prisma
  isActive: z.boolean().default(true),
})

// FIXED: hostelBedSchema - changed bedNumber to number
export const hostelBedSchema = z.object({
  number: requiredString.max(50), // FIXED: Changed from bedNumber to number
  roomId: requiredString,
  isOccupied: z.boolean().default(false),
})

// FIXED: Added studentHostelSchema for hostel assignments
export const studentHostelSchema = z.object({
  studentId: requiredString,
  hostelId: requiredString,
  bedId: requiredString,
  startDate: dateString, // Required in Prisma
  endDate: dateString.optional(),
  messPlan: optionalString,
  isActive: z.boolean().default(true),
})

export const messMenuSchema = z.object({
  schoolId: requiredString,
  date: dateString,
  dayOfWeek: optionalString,
  breakfast: optionalString,
  lunch: optionalString,
  dinner: optionalString,
  snacks: optionalString,
  mealType: optionalString,
  isActive: z.boolean().default(true),
})

// ============ INVENTORY ============
export const vendorSchema = z.object({
  name: requiredString.max(200),
  code: requiredString.max(50),
  schoolId: requiredString,
  contactPerson: optionalString,
  phone: phone,
  email: optionalEmail,
  address: optionalString,
  gst: optionalString,
  isActive: z.boolean().default(true),
})

// FIXED: purchaseOrderSchema - status enum matches Prisma
export const purchaseOrderSchema = z.object({
  orderNumber: requiredString.max(50),
  schoolId: requiredString,
  vendorId: requiredString,
  orderDate: dateString,
  expectedDelivery: dateString.optional(),
  status: PurchaseOrderStatus.default('DRAFT'), // FIXED: Uses corrected enum
  totalAmount: nonNegativeNumber.default(0),
  notes: optionalString,
})

// FIXED: Added purchaseOrderItemSchema
export const purchaseOrderItemSchema = z.object({
  purchaseOrderId: requiredString,
  itemName: requiredString.max(200),
  quantity: positiveNumber.int(),
  unitPrice: positiveNumber,
  totalPrice: positiveNumber,
})

export const assetSchema = z.object({
  name: requiredString.max(200),
  schoolId: requiredString,
  assetType: AssetType,
  code: requiredString.max(50),
  description: optionalString,
  purchaseDate: dateString.optional(),
  purchasePrice: nonNegativeNumber.optional(),
  currentValue: nonNegativeNumber.optional(),
  location: optionalString,
  condition: optionalString,
  isDurable: z.boolean().default(true),
  isActive: z.boolean().default(true),
})

// ============ LMS ============
// FIXED: courseSchema - schoolId is required in Prisma
export const courseSchema = z.object({
  name: requiredString.max(200),
  code: requiredString.max(50),
  schoolId: requiredString, // FIXED: Changed from optional to required
  subjectId: optionalString,
  classId: optionalString,
  teacherId: optionalString,
  description: optionalString,
  startDate: dateString.optional(),
  endDate: dateString.optional(),
  isActive: z.boolean().default(true),
})

export const assignmentSchema = z.object({
  title: requiredString.max(200),
  courseId: requiredString,
  description: optionalString,
  dueDate: dateString,
  maxScore: positiveNumber,
  attachments: z.record(z.unknown()).optional().nullable(),
  isActive: z.boolean().default(true),
})

// FIXED: assignmentSubmissionSchema - changed marks to score
export const assignmentSubmissionSchema = z.object({
  assignmentId: requiredString,
  studentId: requiredString,
  content: optionalString,
  attachments: z.record(z.unknown()).optional().nullable(),
  submittedAt: dateString,
  score: nonNegativeNumber.optional().nullable(), // FIXED: Changed from marks to score
  feedback: optionalString,
  isLate: z.boolean().default(false),
})

export const examSchema = z.object({
  courseId: requiredString,
  title: requiredString.max(200),
  description: optionalString,
  examDate: dateString,
  duration: positiveNumber.int().optional(),
  maxScore: positiveNumber,
  isActive: z.boolean().default(true),
})

export const examResultSchema = z.object({
  examId: requiredString,
  studentId: requiredString,
  score: nonNegativeNumber,
  remarks: optionalString,
})

export const reportCardSchema = z.object({
  studentId: requiredString,
  academicYearId: requiredString,
  term: requiredString.max(50),
  grades: z.record(z.any()), // JSON field
  overallScore: nonNegativeNumber.optional(),
  remarks: optionalString,
  isPublished: z.boolean().default(false),
})

// ============ COMMUNICATION ============
export const announcementSchema = z.object({
  title: requiredString.max(200),
  schoolId: requiredString,
  content: requiredString,
  targetRole: optionalString,
  targetClass: optionalString,
  priority: optionalString.default('NORMAL'), // FIXED: Changed from enum to string to match Prisma
  attachments: z.record(z.unknown()).optional().nullable(),
  publishedAt: dateString.optional(),
  isActive: z.boolean().default(true),
})

// FIXED: messageSchema - subject is optional in Prisma
export const messageSchema = z.object({
  senderId: requiredString,
  receiverId: requiredString,
  subject: optionalString, // FIXED: Changed from required to optional
  content: requiredString,
  isRead: z.boolean().default(false),
})

export const notificationSchema = z.object({
  userId: requiredString,
  title: requiredString.max(200),
  message: requiredString,
  type: z.enum(['INFO', 'WARNING', 'SUCCESS', 'ERROR', 'REMINDER']).default('INFO'),
  link: optionalString,
  isRead: z.boolean().default(false),
})

export const eventSchema = z.object({
  title: requiredString.max(200),
  schoolId: requiredString,
  description: optionalString,
  eventDate: dateString,
  location: optionalString,
  organizer: optionalString,
  isPublic: z.boolean().default(true),
  isActive: z.boolean().default(true),
})

// ============ CANTEEN ============
// FIXED: menuItemSchema - changed image to imageUrl, removed isVegetarian, added isActive
export const menuItemSchema = z.object({
  name: requiredString.max(200),
  schoolId: requiredString,
  category: requiredString.max(100),
  price: positiveNumber,
  description: optionalString,
  imageUrl: optionalString, // FIXED: Changed from image to imageUrl
  // REMOVED: isVegetarian field doesn't exist in Prisma
  isAvailable: z.boolean().default(true),
  isActive: z.boolean().default(true), // FIXED: Added to match Prisma
})

export const canteenOrderSchema = z.object({
  orderNumber: requiredString.max(50),
  studentId: requiredString,
  items: z.array(z.object({
    menuItemId: requiredString,
    quantity: positiveNumber.int(),
    price: positiveNumber,
  })).min(1),
  totalAmount: positiveNumber,
  status: OrderStatus.default('PENDING'),
  paymentMode: PaymentMode.optional(),
  notes: optionalString,
})

export const smartWalletSchema = z.object({
  studentId: requiredString,
  balance: nonNegativeNumber.default(0),
  isActive: z.boolean().default(true),
})

// FIXED: walletTransactionSchema - changed referenceId to reference
export const walletTransactionSchema = z.object({
  walletId: requiredString,
  type: TransactionType,
  amount: positiveNumber,
  description: optionalString,
  reference: optionalString, // FIXED: Changed from referenceId to reference
  balanceBefore: nonNegativeNumber,
  balanceAfter: nonNegativeNumber,
})

// ============ MARKETPLACE ============
// FIXED: productSchema - changed image to imageUrl, removed sku
export const productSchema = z.object({
  name: requiredString.max(200),
  schoolId: requiredString,
  category: ProductCategory,
  price: positiveNumber,
  description: optionalString,
  imageUrl: optionalString, // FIXED: Changed from image to imageUrl
  stock: nonNegativeNumber.int().default(0),
  // REMOVED: sku field doesn't exist in Prisma
  isActive: z.boolean().default(true),
})

export const marketplaceOrderSchema = z.object({
  orderNumber: requiredString.max(50),
  studentId: requiredString,
  items: z.array(z.object({
    productId: requiredString,
    quantity: positiveNumber.int(),
    price: positiveNumber,
  })).min(1),
  totalAmount: positiveNumber,
  status: MarketplaceOrderStatus.default('PENDING'),
  paymentMode: PaymentMode.optional(),
  shippingAddress: optionalString,
  notes: optionalString,
})

// ============ SECURITY ============
// FIXED: auditLogSchema - changed oldValue/newValue to changes
export const auditLogSchema = z.object({
  userId: optionalString,
  action: requiredString.max(100),
  entity: requiredString.max(100),
  entityId: optionalString,
  changes: z.record(z.unknown()).optional().nullable(), // FIXED: Single field instead of oldValue/newValue
  ipAddress: optionalString,
  userAgent: optionalString,
})

// FIXED: dataBackupSchema - aligned with Prisma model (no schoolId, added location, startedAt)
export const dataBackupSchema = z.object({
  fileName: requiredString.max(255),
  fileSize: z.number().optional(), // Float in Prisma, optional
  location: requiredString.max(500), // FIXED: Added required location field
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED']).default('COMPLETED'),
  backupType: requiredString.max(50), // FIXED: String in Prisma, not enum
  startedAt: dateString, // FIXED: Added required startedAt field
  completedAt: dateString.optional(), // FIXED: Added optional completedAt field
})

// FIXED: complianceRecordSchema - field names to match Prisma
export const complianceRecordSchema = z.object({
  schoolId: requiredString,
  complianceType: requiredString.max(100), // FIXED: Changed from type to complianceType
  description: optionalString, // FIXED: Changed from required to optional
  status: optionalString.default('ACTIVE'), // FIXED: Changed to string with default
  validFrom: dateString.optional(), // FIXED: Changed from dueDate
  validUntil: dateString.optional(), // FIXED: Changed from completedDate
  documents: z.record(z.unknown()).optional().nullable(), // FIXED: Changed from evidence to documents
  notes: optionalString,
  isActive: z.boolean().default(true), // FIXED: Added
})

// ============ USER & ROLE ============
// FIXED: userSchema - changed name to firstName/lastName to match Prisma, schoolId is required
export const userSchema = z.object({
  email: email.max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
  firstName: requiredString.max(100), // FIXED: Changed from name to firstName
  lastName: requiredString.max(100), // FIXED: Added lastName
  phone: phone, // FIXED: Added phone field
  role: UserRole,
  schoolId: requiredString, // FIXED: Changed from optional to required
  isActive: z.boolean().default(true),
})

export const userUpdateSchema = userSchema.partial().omit({ password: true })

export const roleSchema = z.object({
  name: requiredString.max(100),
  schoolId: requiredString,
  // Either flat { key: bool } or per-module { module: { view, create, edit, delete } }
  permissions: z.record(z.union([z.boolean(), z.record(z.boolean())])),
  description: optionalString,
  isActive: z.boolean().default(true),
})

export const loginSchema = z.object({
  email: email,
  password: z.string().min(1, 'Password is required'),
})

// ============ MISSING SCHEMAS ============
// UserCustomRole schema
export const userCustomRoleSchema = z.object({
  userId: requiredString,
  roleId: requiredString,
})

// StudentSibling schema
export const studentSiblingSchema = z.object({
  studentId: requiredString,
  siblingId: requiredString,
  relationship: optionalString,
})

// Library schema
export const librarySchema = z.object({
  name: requiredString.max(200),
  schoolId: requiredString,
  location: optionalString,
  capacity: nonNegativeNumber.int().optional(),
  isActive: z.boolean().default(true),
})

// TransportAlert schema
export const transportAlertSchema = z.object({
  vehicleId: requiredString,
  alertType: requiredString.max(50),
  message: requiredString.max(500),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  isResolved: z.boolean().default(false),
  resolvedAt: dateString.optional(),
  resolvedBy: optionalString,
})

// StudentAttendance schema
export const studentAttendanceSchema = z.object({
  studentId: requiredString,
  date: dateString,
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'EXCUSED']).default('PRESENT'),
  remarks: optionalString,
})

// Type exports
export type SchoolInput = z.infer<typeof schoolSchema>
export type BranchInput = z.infer<typeof branchSchema>
export type AcademicYearInput = z.infer<typeof academicYearSchema>
export type ClassInput = z.infer<typeof classSchema>
export type SectionInput = z.infer<typeof sectionSchema>
export type SubjectInput = z.infer<typeof subjectSchema>
export type StudentInput = z.infer<typeof studentSchema>
export type GuardianInput = z.infer<typeof guardianSchema>
export type StaffInput = z.infer<typeof staffSchema>
export type AdmissionInput = z.infer<typeof admissionSchema>
export type FeeInput = z.infer<typeof feeSchema>
export type FeePaymentInput = z.infer<typeof feePaymentSchema>
export type BookInput = z.infer<typeof bookSchema>
export type RouteInput = z.infer<typeof routeSchema>
export type VehicleInput = z.infer<typeof vehicleSchema>
export type HostelInput = z.infer<typeof hostelSchema>
export type VendorInput = z.infer<typeof vendorSchema>
export type AssetInput = z.infer<typeof assetSchema>
export type CourseInput = z.infer<typeof courseSchema>
export type AssignmentInput = z.infer<typeof assignmentSchema>
export type ExamInput = z.infer<typeof examSchema>
export type AnnouncementInput = z.infer<typeof announcementSchema>
export type MessageInput = z.infer<typeof messageSchema>
export type EventInput = z.infer<typeof eventSchema>
export type MenuItemInput = z.infer<typeof menuItemSchema>
export type ProductInput = z.infer<typeof productSchema>
export type UserInput = z.infer<typeof userSchema>
export type RoleInput = z.infer<typeof roleSchema>
