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
// ==========================================
// LEAVE SCHEMAS
// ==========================================

export const createLeaveRequestSchema = z
  .object({
    leaveTypeId: z.string().min(1, 'Vui lòng chọn loại nghỉ phép'),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày bắt đầu phải theo định dạng YYYY-MM-DD'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày kết thúc phải theo định dạng YYYY-MM-DD'),
    totalDays: z.number().positive('Số ngày nghỉ phải lớn hơn 0').max(365, 'Số ngày nghỉ tối đa 365 ngày'),
    reason: z.string().max(1000, 'Lý do tối đa 1000 ký tự').optional(),
    attachmentUrl: z.string().max(500).optional(),
  })
  .refine((data) => data.startDate <= data.endDate, {
    message: 'Ngày kết thúc phải sau hoặc cùng ngày bắt đầu',
    path: ['endDate'],
  })

export const approveLeaveSchema = z.object({
  action: z.enum(['APPROVED', 'REJECTED']),
  rejectReason: z.string().max(500, 'Lý do từ chối tối đa 500 ký tự').optional(),
})

// ==========================================
// OVERTIME SCHEMAS
// ==========================================

export const createOvertimeRequestSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày làm thêm phải theo định dạng YYYY-MM-DD'),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Giờ bắt đầu phải theo định dạng HH:mm'),
    endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Giờ kết thúc phải theo định dạng HH:mm'),
    hours: z.number().positive('Số giờ làm thêm phải lớn hơn 0').max(24, 'Số giờ làm thêm tối đa 24 giờ'),
    reason: z.string().max(1000, 'Lý do tối đa 1000 ký tự').optional(),
  })
  .refine((data) => data.startTime < data.endTime, {
    message: 'Giờ kết thúc phải sau giờ bắt đầu',
    path: ['endTime'],
  })

export const approveOvertimeSchema = z.object({
  action: z.enum(['APPROVED', 'REJECTED']),
  rejectReason: z.string().max(500, 'Lý do từ chối tối đa 500 ký tự').optional(),
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
export type ApproveLeaveInput = z.infer<typeof approveLeaveSchema>
export type CreateOvertimeInput = z.infer<typeof createOvertimeRequestSchema>
export type ApproveOvertimeInput = z.infer<typeof approveOvertimeSchema>
export type CreateBranchInput = z.infer<typeof createBranchSchema>
