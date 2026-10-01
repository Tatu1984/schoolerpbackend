import {
  UserRole,
  Gender,
  BloodGroup,
  StaffType,
  AdmissionStatus,
  IssueStatus,
  AssetType,
  FeeType,
  FeeFrequency,
  PaymentStatus,
  PaymentMode,
  PurchaseOrderStatus,
  OrderStatus,
  MarketplaceOrderStatus,
  LeaveStatus,
  TransactionType,
  ProductCategory
} from '@prisma/client'

// Re-export Prisma enums
export {
  UserRole,
  Gender,
  BloodGroup,
  StaffType,
  AdmissionStatus,
  IssueStatus,
  AssetType,
  FeeType,
  FeeFrequency,
  PaymentStatus,
  PaymentMode,
  PurchaseOrderStatus,
  OrderStatus,
  MarketplaceOrderStatus,
  LeaveStatus,
  TransactionType,
  ProductCategory
}

// Session types
export interface SessionUser {
  id: string
  email: string
  name: string
  role: UserRole
  schoolId?: string
  isActive: boolean
}

export interface Session {
  user: SessionUser
  expires: string
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasMore: boolean
  }
}

export interface ApiError {
  error: string
  message?: string
  statusCode: number
}

// Query params
export interface PaginationParams {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface SearchParams extends PaginationParams {
  search?: string
  filter?: Record<string, string | number | boolean>
}

// Form types
export interface StudentFormData {
  firstName: string
  lastName: string
  email?: string
  phone?: string
  dateOfBirth: string
  gender: Gender
  bloodGroup?: BloodGroup
  nationality?: string
  religion?: string
  address?: string
  classId: string
  sectionId?: string
  rollNumber?: string
  admissionNumber: string
  admissionDate?: string
  previousSchool?: string
  medicalInfo?: Record<string, unknown>
  documents?: Record<string, unknown>
  customFields?: Record<string, unknown>
  photo?: string
}

export interface StaffFormData {
  firstName: string
  lastName: string
  email: string
  phone?: string
  dateOfBirth?: string
  gender: Gender
  bloodGroup?: BloodGroup
  address?: string
  employeeId: string
  staffType: StaffType
  designation?: string
  department?: string
  joiningDate?: string
  qualification?: string
  experience?: number
  salary?: number
  bankDetails?: Record<string, unknown>
  documents?: Record<string, unknown>
}

export interface GuardianFormData {
  firstName: string
  lastName: string
  relationship: string
  phone: string
  email?: string
  occupation?: string
  address?: string
  isPrimary?: boolean
}

export interface FeeFormData {
  name: string
  type: FeeType
  amount: number
  frequency: FeeFrequency
  classId?: string
  dueDate?: string
  description?: string
  isActive?: boolean
}

export interface ClassFormData {
  name: string
  grade: number
  branchId?: string
  academicYearId: string
  capacity?: number
  description?: string
}

export interface SubjectFormData {
  name: string
  code: string
  classId?: string
  description?: string
  isActive?: boolean
}

// Component Props
export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export interface TableColumn<T> {
  key: keyof T | string
  label: string
  sortable?: boolean
  render?: (value: unknown, row: T) => React.ReactNode
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: React.ReactNode
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
}

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label?: string
  error?: string
  options: SelectOption[]
  onChange?: (value: string) => void
}
