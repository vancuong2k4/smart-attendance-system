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
  photo: z.string().optional(),
  checkInPhoto: z.string().optional(),
})

export const checkOutSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().positive().optional(),
  deviceInfo: z.string().max(500).optional(),
  photo: z.string().optional(),
  checkOutPhoto: z.string().optional(),
})

export const manualAttendanceSchema = z.object({
  employeeId: z.string().cuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải theo định dạng YYYY-MM-DD'),
  checkInTime: z.string().optional(),
  checkOutTime: z.string().optional(),
  note: z.string().max(500).optional(),
})

const isValidTimeStringOrIso = (val: string | null | undefined): boolean => {
  if (!val || !val.trim()) return true
  const trimmed = val.trim()
  const isTimeFormat = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(trimmed)
  if (isTimeFormat) return true
  return !isNaN(Date.parse(trimmed))
}

const parseTimeStringToMinutes = (val: string | null | undefined): number | null => {
  if (!val || !val.trim()) return null
  const trimmed = val.trim()
  if (/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(trimmed)) {
    const [h, m] = trimmed.split(':').map(Number)
    return h * 60 + m
  }
  const date = new Date(trimmed)
  if (!isNaN(date.getTime())) {
    return date.getTime()
  }
  return null
}

export const createAttendanceAdjustmentSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải theo định dạng YYYY-MM-DD'),
    type: z.enum([
      'FORGOT_CHECKIN',
      'FORGOT_CHECKOUT',
      'FORGOT_BOTH',
      'GPS_ERROR',
      'BUSINESS_OUTSIDE',
    ]),
    requestedCheckIn: z
      .string()
      .optional()
      .nullable()
      .refine(isValidTimeStringOrIso, {
        message: 'Giờ check-in không đúng định dạng (HH:mm hoặc ISO datetime)',
      }),
    requestedCheckOut: z
      .string()
      .optional()
      .nullable()
      .refine(isValidTimeStringOrIso, {
        message: 'Giờ check-out không đúng định dạng (HH:mm hoặc ISO datetime)',
      }),
    reason: z.string().min(5, 'Lý do tối thiểu 5 ký tự').max(1000, 'Lý do tối đa 1000 ký tự'),
    evidenceUrl: z.string().max(1000).optional().nullable(),
  })
  .refine(
    (data) => {
      const hasIn = Boolean(data.requestedCheckIn && data.requestedCheckIn.trim())
      const hasOut = Boolean(data.requestedCheckOut && data.requestedCheckOut.trim())
      return hasIn || hasOut
    },
    {
      message: 'Cần cung cấp ít nhất giờ check-in hoặc check-out đề xuất',
      path: ['requestedCheckIn'],
    }
  )
  .refine(
    (data) => {
      if (data.requestedCheckIn && data.requestedCheckOut) {
        const inMins = parseTimeStringToMinutes(data.requestedCheckIn)
        const outMins = parseTimeStringToMinutes(data.requestedCheckOut)
        if (inMins !== null && outMins !== null) {
          return outMins > inMins
        }
        return data.requestedCheckIn < data.requestedCheckOut
      }
      return true
    },
    {
      message: 'Giờ check-out đề xuất phải sau giờ check-in đề xuất',
      path: ['requestedCheckOut'],
    }
  )

export const approveAttendanceAdjustmentSchema = z.object({
  action: z.enum(['APPROVED', 'REJECTED']),
  rejectReason: z.string().max(500, 'Lý do từ chối tối đa 500 ký tự').optional(),
})

// ==========================================
// EMPLOYEE SCHEMAS
// ==========================================

export const createEmployeeSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự').optional().or(z.literal('')),
  employeeCode: z.string().min(2, 'Mã nhân viên tối thiểu 2 ký tự').max(20, 'Mã nhân viên tối đa 20 ký tự'),
  branchId: z.string().min(1, 'Vui lòng chọn chi nhánh'),
  departmentId: z.string().min(1, 'Vui lòng chọn phòng ban'),
  fullName: z.string().min(2, 'Họ tên tối thiểu 2 ký tự').max(100, 'Họ tên tối đa 100 ký tự'),
  dateOfBirth: z.string().optional().nullable(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional().nullable(),
  phoneNumber: z.string().max(20).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  position: z.string().max(100).optional().nullable(),
  startDate: z.string().optional(),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'PROBATION']).default('FULL_TIME'),
  role: z.enum(['SUPER_ADMIN', 'BRANCH_ADMIN', 'HR_MANAGER', 'EMPLOYEE']).default('EMPLOYEE'),
})

export const updateEmployeeSchema = z.object({
  email: z.string().email('Email không hợp lệ').optional(),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự').optional().or(z.literal('')),
  employeeCode: z.string().min(2, 'Mã nhân viên tối thiểu 2 ký tự').max(20).optional(),
  branchId: z.string().min(1).optional(),
  departmentId: z.string().min(1).optional(),
  fullName: z.string().min(2, 'Họ tên tối thiểu 2 ký tự').max(100).optional(),
  dateOfBirth: z.string().optional().nullable(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional().nullable(),
  phoneNumber: z.string().max(20).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  position: z.string().max(100).optional().nullable(),
  startDate: z.string().optional(),
  endDate: z.string().optional().nullable(),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'PROBATION']).optional(),
  role: z.enum(['SUPER_ADMIN', 'BRANCH_ADMIN', 'HR_MANAGER', 'EMPLOYEE']).optional(),
  isActive: z.boolean().optional(),
  annualLeaveBalance: z.number().min(0).optional(),
  sickLeaveBalance: z.number().min(0).optional(),
})

export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>

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

// ==========================================
// NOTIFICATION SCHEMAS
// ==========================================

export const updateNotificationSchema = z
  .object({
    id: z.string().optional(),
    markAllAsRead: z.boolean().optional(),
  })
  .refine((data) => data.id !== undefined || data.markAllAsRead === true, {
    message: 'Phải cung cấp id hoặc markAllAsRead = true',
  })

export type LoginInput = z.infer<typeof loginSchema>
export type CheckInInput = z.infer<typeof checkInSchema>
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>
export type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestSchema>
export type ApproveLeaveInput = z.infer<typeof approveLeaveSchema>
export type CreateOvertimeInput = z.infer<typeof createOvertimeRequestSchema>
export type ApproveOvertimeInput = z.infer<typeof approveOvertimeSchema>
export type CreateBranchInput = z.infer<typeof createBranchSchema>
export type UpdateNotificationInput = z.infer<typeof updateNotificationSchema>
export type CreateAttendanceAdjustmentInput = z.infer<typeof createAttendanceAdjustmentSchema>
export type ApproveAttendanceAdjustmentInput = z.infer<typeof approveAttendanceAdjustmentSchema>
