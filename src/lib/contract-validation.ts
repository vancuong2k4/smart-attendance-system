import { z } from 'zod'
import { ContractType, ContractStatus } from '@prisma/client'

export const contractCreateSchema = z.object({
  contractNumber: z
    .string()
    .min(3, 'Mã hợp đồng phải có ít nhất 3 ký tự')
    .max(50, 'Mã hợp đồng không được vượt quá 50 ký tự')
    .trim(),
  employeeId: z.string().min(1, 'Vui lòng chọn nhân viên'),
  contractType: z.nativeEnum(ContractType),
  status: z.nativeEnum(ContractStatus).default(ContractStatus.ACTIVE),
  jobTitle: z.string().min(2, 'Chức danh phải có ít nhất 2 ký tự').max(100).trim(),
  signDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Ngày ký không hợp lệ',
  }),
  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Ngày hiệu lực không hợp lệ',
  }),
  endDate: z
    .string()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'Ngày hết hạn không hợp lệ',
    })
    .optional()
    .nullable(),
  insuranceSalary: z.number().min(0, 'Mức lương bảo hiểm không được âm').default(0),
  grossSalary: z.number().min(0, 'Tổng mức lương không được âm').default(0),
  workingHoursPerWeek: z.number().min(0).max(60).default(40),
  signerName: z.string().max(100).optional().nullable(),
  signerRole: z.string().max(100).optional().nullable(),
  fileUrl: z.string().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
})

export const contractUpdateSchema = contractCreateSchema.partial()
