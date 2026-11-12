import { z } from 'zod'

/**
 * Validation schema for creating a new Branch with Geofence settings
 */
export const branchCreateSchema = z.object({
  name: z
    .string()
    .min(2, 'Tên chi nhánh phải có ít nhất 2 ký tự')
    .max(100, 'Tên chi nhánh không được vượt quá 100 ký tự')
    .trim(),
  code: z
    .string()
    .min(2, 'Mã chi nhánh phải có ít nhất 2 ký tự')
    .max(20, 'Mã chi nhánh không được vượt quá 20 ký tự')
    .regex(/^[A-Za-z0-9_-]+$/, 'Mã chi nhánh chỉ được chứa chữ cái, chữ số, dấu gạch ngang (-) và gạch dưới (_)')
    .transform((val) => val.toUpperCase().trim()),
  address: z
    .string()
    .max(255, 'Địa chỉ không được vượt quá 255 ký tự')
    .optional()
    .nullable(),
  phone: z
    .string()
    .max(20, 'Số điện thoại không được vượt quá 20 ký tự')
    .optional()
    .nullable(),
  latitude: z
    .number()
    .min(-90, 'Vĩ độ phải nằm trong khoảng từ -90 đến 90')
    .max(90, 'Vĩ độ phải nằm trong khoảng từ -90 đến 90'),
  longitude: z
    .number()
    .min(-180, 'Kinh độ phải nằm trong khoảng từ -180 đến 180')
    .max(180, 'Kinh độ phải nằm trong khoảng từ -180 đến 180'),
  gpsRadius: z
    .number()
    .int('Bán kính phải là số nguyên')
    .min(20, 'Bán kính tối thiểu là 20 mét')
    .max(5000, 'Bán kính tối đa là 5000 mét')
    .default(100),
  isActive: z.boolean().default(true).optional(),
  companyId: z.string().optional(),
})

export type BranchCreateInput = z.infer<typeof branchCreateSchema>

/**
 * Validation schema for updating an existing Branch
 */
export const branchUpdateSchema = branchCreateSchema.partial().omit({ companyId: true })

export type BranchUpdateInput = z.infer<typeof branchUpdateSchema>

/**
 * Validation schema for testing coordinates against a branch Geofence
 */
export const geofenceTestSchema = z.object({
  latitude: z
    .number()
    .min(-90, 'Vĩ độ phải nằm trong khoảng từ -90 đến 90')
    .max(90, 'Vĩ độ phải nằm trong khoảng từ -90 đến 90'),
  longitude: z
    .number()
    .min(-180, 'Kinh độ phải nằm trong khoảng từ -180 đến 180')
    .max(180, 'Kinh độ phải nằm trong khoảng từ -180 đến 180'),
  accuracy: z.number().min(0, 'Độ chính xác GPS phải >= 0').optional().nullable(),
})

export type GeofenceTestInput = z.infer<typeof geofenceTestSchema>

/**
 * Validation schema for querying branches
 */
export const branchQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['all', 'active', 'inactive']).default('all').optional(),
  includeCounts: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
})

export type BranchQueryInput = z.infer<typeof branchQuerySchema>
