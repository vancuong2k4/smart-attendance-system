import { z } from 'zod'

const timeStringRegex = /^([01]\d|2[0-3]):[0-5]\d$/
const dateStringRegex = /^\d{4}-\d{2}-\d{2}$/

/**
 * Validation schema for creating a Work Schedule (Ca làm việc)
 */
export const scheduleCreateSchema = z.object({
  branchId: z.string().min(1, 'Chi nhánh là bắt buộc'),
  name: z
    .string()
    .min(2, 'Tên ca làm việc phải có ít nhất 2 ký tự')
    .max(100, 'Tên ca làm việc không vượt quá 100 ký tự')
    .trim(),
  startTime: z
    .string()
    .regex(timeStringRegex, 'Giờ bắt đầu phải theo định dạng HH:mm (VD: 08:00)'),
  endTime: z
    .string()
    .regex(timeStringRegex, 'Giờ kết thúc phải theo định dạng HH:mm (VD: 17:00)'),
  lunchStart: z
    .string()
    .regex(timeStringRegex, 'Giờ nghỉ trưa bắt đầu phải theo định dạng HH:mm')
    .optional()
    .nullable(),
  lunchEnd: z
    .string()
    .regex(timeStringRegex, 'Giờ nghỉ trưa kết thúc phải theo định dạng HH:mm')
    .optional()
    .nullable(),
  workDays: z
    .array(z.number().int().min(1).max(7))
    .min(1, 'Phải chọn ít nhất 1 ngày làm việc trong tuần')
    .default([1, 2, 3, 4, 5]),
  lateThreshold: z
    .number()
    .int()
    .min(0, 'Ngưỡng đi muộn không thể âm')
    .max(120, 'Ngưỡng đi muộn tối đa 120 phút')
    .default(15),
  earlyThreshold: z
    .number()
    .int()
    .min(0, 'Ngưỡng về sớm không thể âm')
    .max(120, 'Ngưỡng về sớm tối đa 120 phút')
    .default(15),
  isDefault: z.boolean().default(false).optional(),
  isActive: z.boolean().default(true).optional(),
})

export type ScheduleCreateInput = z.infer<typeof scheduleCreateSchema>

/**
 * Validation schema for updating a Work Schedule
 */
export const scheduleUpdateSchema = scheduleCreateSchema.partial()

export type ScheduleUpdateInput = z.infer<typeof scheduleUpdateSchema>

/**
 * Validation schema for assigning shifts to employees
 */
export const shiftAssignSchema = z.object({
  employeeIds: z
    .array(z.string().min(1))
    .min(1, 'Phải chọn ít nhất 1 nhân viên để phân ca'),
  scheduleId: z.string().min(1, 'Phải chọn ca làm việc'),
  dates: z
    .array(z.string().regex(dateStringRegex, 'Ngày phải theo định dạng YYYY-MM-DD'))
    .min(1, 'Phải chọn ít nhất 1 ngày phân ca'),
  note: z.string().max(255).optional().nullable(),
})

export type ShiftAssignInput = z.infer<typeof shiftAssignSchema>

/**
 * Validation schema for submitting a Shift Swap Request (Đơn đổi ca)
 */
export const shiftSwapCreateSchema = z.object({
  targetEmployeeId: z.string().min(1, 'Phải chọn đồng nghiệp để đổi ca'),
  requesterDate: z
    .string()
    .regex(dateStringRegex, 'Ngày ca của bạn phải theo định dạng YYYY-MM-DD'),
  requesterScheduleId: z.string().min(1, 'Phải chọn ca của bạn cần đổi'),
  targetDate: z
    .string()
    .regex(dateStringRegex, 'Ngày ca đổi phải theo định dạng YYYY-MM-DD'),
  targetScheduleId: z.string().min(1, 'Phải chọn ca của đồng nghiệp muốn nhận'),
  reason: z
    .string()
    .min(5, 'Lý do đổi ca phải có ít nhất 5 ký tự')
    .max(500, 'Lý do đổi ca không được vượt quá 500 ký tự')
    .trim(),
})

export type ShiftSwapCreateInput = z.infer<typeof shiftSwapCreateSchema>

/**
 * Validation schema for peer responding to a swap request
 */
export const peerResponseSchema = z.object({
  action: z.enum(['ACCEPT', 'REJECT'], {
    required_error: 'Hành động phải là ACCEPT hoặc REJECT',
  }),
  rejectReason: z.string().max(300).optional().nullable(),
})

export type PeerResponseInput = z.infer<typeof peerResponseSchema>

/**
 * Validation schema for manager approving/rejecting a swap request
 */
export const managerApprovalSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT'], {
    required_error: 'Hành động phải là APPROVE hoặc REJECT',
  }),
  rejectReason: z.string().max(300).optional().nullable(),
})

export type ManagerApprovalInput = z.infer<typeof managerApprovalSchema>
