import { z } from 'zod'

const timeStringRegex = /^([01]\d|2[0-3]):[0-5]\d$/

/**
 * Validation schema for updating company organization profile
 */
export const companyProfileUpdateSchema = z.object({
  name: z
    .string()
    .min(2, 'Tên doanh nghiệp phải có ít nhất 2 ký tự')
    .max(150, 'Tên doanh nghiệp không được vượt quá 150 ký tự')
    .trim(),
  taxCode: z.string().max(30, 'Mã số thuế tối đa 30 ký tự').optional().nullable(),
  address: z.string().max(255, 'Địa chỉ tối đa 255 ký tự').optional().nullable(),
  phone: z.string().max(25, 'Số điện thoại tối đa 25 ký tự').optional().nullable(),
  email: z
    .string()
    .email('Định dạng email không hợp lệ')
    .optional()
    .nullable()
    .or(z.literal('')),
  logoUrl: z.string().optional().nullable(),
  timezone: z.string().min(2, 'Múi giờ không hợp lệ').default('Asia/Ho_Chi_Minh'),
  currency: z.string().min(2, 'Đơn vị tiền tệ không hợp lệ').default('VND'),
})

export type CompanyProfileUpdateInput = z.infer<typeof companyProfileUpdateSchema>

/**
 * Validation schema for updating system settings
 */
export const systemSettingsUpdateSchema = z.object({
  // 1. Attendance & GPS Rules
  checkInWindowStart: z
    .string()
    .regex(timeStringRegex, 'Giờ bắt đầu check-in phải theo định dạng HH:mm'),
  checkInWindowEnd: z
    .string()
    .regex(timeStringRegex, 'Giờ kết thúc check-in phải theo định dạng HH:mm'),
  checkOutWindowStart: z
    .string()
    .regex(timeStringRegex, 'Giờ bắt đầu check-out phải theo định dạng HH:mm'),
  checkOutWindowEnd: z
    .string()
    .regex(timeStringRegex, 'Giờ kết thúc check-out phải theo định dạng HH:mm'),
  defaultLateThreshold: z
    .number()
    .int('Ngưỡng đi muộn phải là số nguyên')
    .min(0, 'Ngưỡng đi muộn không thể âm')
    .max(120, 'Ngưỡng đi muộn tối đa 120 phút'),
  defaultEarlyThreshold: z
    .number()
    .int('Ngưỡng về sớm phải là số nguyên')
    .min(0, 'Ngưỡng về sớm không thể âm')
    .max(120, 'Ngưỡng về sớm tối đa 120 phút'),
  requireSelfie: z.boolean(),
  requireGps: z.boolean(),
  maxGpsAccuracyMeters: z
    .number()
    .int()
    .min(10, 'Độ chính xác tối thiểu là 10 mét')
    .max(500, 'Độ chính xác tối đa 500 mét'),

  // 2. Payroll & Cycle Settings
  payrollStartDay: z
    .number()
    .int()
    .min(1, 'Ngày bắt đầu kỳ lương từ 1 đến 31')
    .max(31, 'Ngày bắt đầu kỳ lương từ 1 đến 31'),
  payrollEndDay: z
    .number()
    .int()
    .min(1, 'Ngày kết thúc kỳ lương từ 1 đến 31')
    .max(31, 'Ngày kết thúc kỳ lương từ 1 đến 31'),
  attendanceLockDay: z
    .number()
    .int()
    .min(1, 'Ngày khóa công từ ngày 1 đến ngày 28')
    .max(28, 'Ngày khóa công tối đa ngày 28 hàng tháng'),
  standardWorkDaysMonth: z
    .number()
    .min(15, 'Số ngày công chuẩn tối thiểu 15 ngày')
    .max(31, 'Số ngày công chuẩn tối đa 31 ngày'),
  otRateWeekday: z.number().min(1, 'Hệ số OT tối thiểu 1.0').max(5, 'Hệ số OT tối đa 5.0'),
  otRateWeekend: z.number().min(1, 'Hệ số OT tối thiểu 1.0').max(5, 'Hệ số OT tối đa 5.0'),
  otRateHoliday: z.number().min(1, 'Hệ số OT tối thiểu 1.0').max(5, 'Hệ số OT tối đa 5.0'),

  // 3. Leave Policy Rules
  defaultAnnualLeave: z
    .number()
    .min(0, 'Số ngày phép năm tối thiểu là 0')
    .max(30, 'Số ngày phép năm tối đa 30 ngày'),
  defaultSickLeave: z
    .number()
    .min(0, 'Số ngày nghỉ ốm tối thiểu là 0')
    .max(30, 'Số ngày nghỉ ốm tối đa 30 ngày'),
  allowCarryOverLeave: z.boolean(),
  maxCarryOverDays: z
    .number()
    .min(0, 'Số ngày cộng dồn tối thiểu là 0')
    .max(20, 'Số ngày cộng dồn tối đa 20 ngày'),
  carryOverDeadline: z
    .number()
    .int()
    .min(1, 'Tháng hết hạn từ 1 đến 12')
    .max(12, 'Tháng hết hạn từ 1 đến 12'),

  // 4. Notifications & Security
  notifyLateArrival: z.boolean(),
  notifyEarlyLeave: z.boolean(),
  checkInReminder: z.boolean(),
  checkOutReminder: z.boolean(),
  sessionTimeoutMinutes: z
    .number()
    .int()
    .min(15, 'Thời gian hết hạn phiên tối thiểu 15 phút')
    .max(10080, 'Thời gian hết hạn phiên tối đa 7 ngày'),
})

export type SystemSettingsUpdateInput = z.infer<typeof systemSettingsUpdateSchema>
