import { z } from 'zod'

// ==========================================
// AUTH SCHEMAS
// ==========================================

export const loginSchema = z.object({
  email: z.email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
})

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(6),
    newPassword: z.string().min(8, 'Mật khẩu mới tối thiểu 8 ký tự'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  })

// ==========================================
// ATTENDANCE SCHEMAS
// ==========================================

export const checkInSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().positive().optional(),
  deviceInfo: z.string().max(500).optional(),
})

export const checkOutSchema = checkInSchema

export const manualAttendanceSchema = z.object({
  employeeId: z.string().cuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải theo định dạng YYYY-MM-DD'),
  checkInTime: z.string().optional(),
  checkOutTime: z.string().optional(),
  note: z.string().max(500).optional(),
})

// ==========================================
// EMPLOYEE SCHEMAS
// ==========================================

export const createEmployeeSchema = z.object({
  email: z.email('Email không hợp lệ'),
  password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự').optional(),
  employeeCode: z.string().min(2).max(20),
  branchId: z.string().cuid(),
  departmentId: z.string().cuid(),
  fullName: z.string().min(2).max(100),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  phoneNumber: z.string().optional(),
  position: z.string().max(100).optional(),
  startDate: z.string(),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'PROBATION']).default('FULL_TIME'),
  role: z.enum(['SUPER_ADMIN', 'BRANCH_ADMIN', 'HR_MANAGER', 'EMPLOYEE']).default('EMPLOYEE'),
})

// ==========================================
// LEAVE SCHEMAS
// ==========================================

export const createLeaveRequestSchema = z
  .object({
    leaveTypeId: z.string().cuid(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    totalDays: z.number().positive().max(365),
    reason: z.string().max(1000).optional(),
  })
  .refine((data) => new Date(data.startDate) <= new Date(data.endDate), {
    message: 'Ngày kết thúc phải sau ngày bắt đầu',
    path: ['endDate'],
  })

export const approveLeaveSchema = z.object({
  action: z.enum(['APPROVED', 'REJECTED']),
  rejectReason: z.string().max(500).optional(),
})

// ==========================================
// BRANCH SCHEMAS
// ==========================================

export const createBranchSchema = z.object({
  companyId: z.string().cuid(),
  name: z.string().min(2).max(100),
  code: z.string().min(2).max(20),
  address: z.string().max(500).optional(),
  phone: z.string().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  gpsRadius: z.number().int().min(50).max(1000).default(100),
})

export type LoginInput = z.infer<typeof loginSchema>
export type CheckInInput = z.infer<typeof checkInSchema>
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>
export type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestSchema>
export type CreateBranchInput = z.infer<typeof createBranchSchema>
