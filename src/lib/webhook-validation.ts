import { z } from 'zod'
import { WebhookChannel } from '@prisma/client'

export const webhookSubscriptionSchema = z.object({
  name: z.string().min(2, 'Tên webhook phải có ít nhất 2 ký tự').max(100, 'Tên webhook tối đa 100 ký tự').trim(),
  channel: z.nativeEnum(WebhookChannel, {
    errorMap: () => ({ message: 'Kênh tích hợp không hợp lệ' }),
  }),
  url: z.string().url('URL webhook không hợp lệ (phải bắt đầu bằng http:// hoặc https://)'),
  secret: z.string().max(255).optional().nullable(),
  events: z.array(z.string()).min(1, 'Vui lòng chọn ít nhất 1 sự kiện đăng ký'),
  isActive: z.boolean().default(true),
  branchId: z.string().optional().nullable(),
  metadata: z.record(z.any()).optional().nullable(),
})

export const webhookUpdateSchema = webhookSubscriptionSchema.partial()
