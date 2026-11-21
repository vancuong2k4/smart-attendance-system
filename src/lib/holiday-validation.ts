import { z } from 'zod'
import { HolidayType } from '@prisma/client'

export const holidayCreateSchema = z.object({
  name: z
    .string()
    .min(2, 'Tên ngày lễ / ngày nghỉ phải có ít nhất 2 ký tự')
    .max(100, 'Tên ngày lễ không được vượt quá 100 ký tự')
    .trim(),
  code: z
    .string()
    .min(2, 'Mã ngày lễ phải có ít nhất 2 ký tự')
    .max(50, 'Mã ngày lễ không được vượt quá 50 ký tự')
    .regex(
      /^[A-Za-z0-9_-]+$/,
      'Mã ngày lễ chỉ được chứa chữ cái, số, dấu gạch dưới hoặc gạch nối'
    )
    .trim(),
  date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Ngày bắt đầu không hợp lệ',
  }),
  endDate: z
    .string()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'Ngày kết thúc không hợp lệ',
    })
    .optional()
    .nullable(),
  type: z.nativeEnum(HolidayType),
  isPaid: z.boolean().default(true),
  payMultiplier: z
    .number()
    .min(1.0, 'Hệ số lương tối thiểu là 1.0 (100%)')
    .max(5.0, 'Hệ số lương tối đa là 5.0 (500%)')
    .default(3.0),
  year: z.number().int().min(2020).max(2100).default(new Date().getFullYear()),
  branchId: z.string().optional().nullable(),
  description: z.string().max(500, 'Mô tả không được vượt quá 500 ký tự').optional().nullable(),
})

export const holidayUpdateSchema = holidayCreateSchema.partial()

export const holidayBulkImportSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  holidays: z.array(holidayCreateSchema).min(1, 'Danh sách ngày lễ không được rỗng'),
})
