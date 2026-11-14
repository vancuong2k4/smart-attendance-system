import { prisma } from '@/lib/db'
import { WebhookChannel } from '@prisma/client'
import crypto from 'crypto'

export const WebhookEvents = {
  ATTENDANCE_CHECK_IN: 'ATTENDANCE_CHECK_IN',
  ATTENDANCE_CHECK_OUT: 'ATTENDANCE_CHECK_OUT',
  ATTENDANCE_LATE_ALERT: 'ATTENDANCE_LATE_ALERT',
  LEAVE_REQUESTED: 'LEAVE_REQUESTED',
  LEAVE_STATUS_CHANGED: 'LEAVE_STATUS_CHANGED',
  SHIFT_SWAP_REQUESTED: 'SHIFT_SWAP_REQUESTED',
  SECURITY_CRITICAL_ALERT: 'SECURITY_CRITICAL_ALERT',
} as const

export type WebhookEventType = (typeof WebhookEvents)[keyof typeof WebhookEvents] | string

export interface WebhookEventMeta {
  label: string
  category: 'Chấm công' | 'Nghỉ phép' | 'Ca làm việc' | 'Bảo mật'
  description: string
}

export const WEBHOOK_EVENT_MAP: Record<string, WebhookEventMeta> = {
  [WebhookEvents.ATTENDANCE_CHECK_IN]: {
    label: 'Nhân viên Check-in',
    category: 'Chấm công',
    description: 'Kích hoạt khi nhân viên hoàn tất chấm công vào ca',
  },
  [WebhookEvents.ATTENDANCE_CHECK_OUT]: {
    label: 'Nhân viên Check-out',
    category: 'Chấm công',
    description: 'Kích hoạt khi nhân viên hoàn tất chấm công ra ca',
  },
  [WebhookEvents.ATTENDANCE_LATE_ALERT]: {
    label: 'Cảnh báo đi muộn',
    category: 'Chấm công',
    description: 'Kích hoạt khi nhân viên chấm công muộn hơn ngưỡng quy định',
  },
  [WebhookEvents.LEAVE_REQUESTED]: {
    label: 'Đơn nghỉ phép mới',
    category: 'Nghỉ phép',
    description: 'Kích hoạt khi có nhân viên nộp đơn xin nghỉ phép',
  },
  [WebhookEvents.LEAVE_STATUS_CHANGED]: {
    label: 'Cập nhật đơn nghỉ phép',
    category: 'Nghỉ phép',
    description: 'Kích hoạt khi đơn nghỉ phép được phê duyệt hoặc từ chối',
  },
  [WebhookEvents.SHIFT_SWAP_REQUESTED]: {
    label: 'Yêu cầu đổi ca làm việc',
    category: 'Ca làm việc',
    description: 'Kích hoạt khi có yêu cầu đổi ca làm việc mới',
  },
  [WebhookEvents.SECURITY_CRITICAL_ALERT]: {
    label: 'Cảnh báo bảo mật nghiêm trọng',
    category: 'Bảo mật',
    description: 'Kích hoạt khi có sự kiện kiểm toán mức độ CRITICAL hoặc SECURITY',
  },
}

/**
 * Ký HMAC-SHA256 cho payload Webhook chuẩn
 */
export function signHmacSha256(payloadStr: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payloadStr).digest('hex')
}

/**
 * Định dạng tin nhắn HTML gửi tới Telegram Bot
 */
export function formatTelegramMessage(event: string, payload: any): string {
  const eventMeta = WEBHOOK_EVENT_MAP[event] || { label: event }
  const time = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  const date = new Date().toLocaleDateString('vi-VN')

  if (event === WebhookEvents.ATTENDANCE_CHECK_IN) {
    return (
      `🟢 <b>[CHẤM CÔNG VÀO CA]</b>\n\n` +
      `👤 <b>Nhân viên:</b> ${payload.employeeName || 'N/A'} (<code>${payload.employeeCode || 'N/A'}</code>)\n` +
      `🏢 <b>Chi nhánh:</b> ${payload.branchName || 'N/A'}\n` +
      `🕒 <b>Thời gian:</b> ${payload.time || time} - ${date}\n` +
      `📍 <b>Vị trí GPS:</b> ${payload.distanceMeters !== undefined ? `${payload.distanceMeters}m (Hợp lệ)` : 'Đã xác thực'}\n` +
      `💬 <i>Hệ thống Điểm danh Thông minh Smart Attendance</i>`
    )
  }

  if (event === WebhookEvents.ATTENDANCE_CHECK_OUT) {
    return (
      `🔵 <b>[CHẤM CÔNG RA CA]</b>\n\n` +
      `👤 <b>Nhân viên:</b> ${payload.employeeName || 'N/A'} (<code>${payload.employeeCode || 'N/A'}</code>)\n` +
      `🏢 <b>Chi nhánh:</b> ${payload.branchName || 'N/A'}\n` +
      `🕒 <b>Thời gian:</b> ${payload.time || time} - ${date}\n` +
      `⏱️ <b>Thời lượng làm:</b> ${payload.workHours || 'N/A'} giờ\n` +
      `💬 <i>Hệ thống Điểm danh Thông minh Smart Attendance</i>`
    )
  }

  if (event === WebhookEvents.ATTENDANCE_LATE_ALERT) {
    return (
      `⚠️ <b>[CẢNH BÁO ĐI MUỘN]</b>\n\n` +
      `👤 <b>Nhân viên:</b> ${payload.employeeName || 'N/A'} (<code>${payload.employeeCode || 'N/A'}</code>)\n` +
      `🏢 <b>Chi nhánh:</b> ${payload.branchName || 'N/A'}\n` +
      `🕒 <b>Thời gian:</b> ${payload.time || time}\n` +
      `⏰ <b>Số phút muộn:</b> <b>${payload.lateMinutes || 0} phút</b>\n` +
      `🚨 <i>Yêu cầu bộ phận nhân sự kiểm tra giải trình</i>`
    )
  }

  if (event === WebhookEvents.SECURITY_CRITICAL_ALERT) {
    return (
      `🚨 <b>[CẢNH BÁO AN NINH HỆ THỐNG]</b>\n\n` +
      `⚡ <b>Hành động:</b> <code>${payload.action || 'SECURITY_ALERT'}</code>\n` +
      `👤 <b>Người thực hiện:</b> ${payload.userEmail || 'Hệ thống'}\n` +
      `🌐 <b>Địa chỉ IP:</b> <code>${payload.ipAddress || 'Unknown'}</code>\n` +
      `🕒 <b>Thời gian:</b> ${time} - ${date}\n` +
      `⚠️ <i>Kiểm tra ngay nhật ký kiểm toán trên bảng điều khiển Admin!</i>`
    )
  }

  return (
    `🔔 <b>[${eventMeta.label.toUpperCase()}]</b>\n\n` +
    `📌 <b>Nội dung:</b> ${payload.title || payload.message || JSON.stringify(payload)}\n` +
    `🕒 <b>Thời gian:</b> ${time} - ${date}\n` +
    `💬 <i>Hệ thống Smart Attendance</i>`
  )
}

/**
 * Định dạng Embed Payload cho Discord Webhook
 */
export function formatDiscordPayload(event: string, payload: any) {
  const eventMeta = WEBHOOK_EVENT_MAP[event] || { label: event }

  let color = 0x6366f1 // Indigo default
  if (event === WebhookEvents.ATTENDANCE_CHECK_IN) color = 0x10b981 // Emerald
  if (event === WebhookEvents.ATTENDANCE_CHECK_OUT) color = 0x3b82f6 // Blue
  if (event === WebhookEvents.ATTENDANCE_LATE_ALERT) color = 0xf59e0b // Amber
  if (event === WebhookEvents.SECURITY_CRITICAL_ALERT) color = 0xef4444 // Red

  const fields: Array<{ name: string; value: string; inline?: boolean }> = []

  if (payload.employeeName) {
    fields.push({
      name: 'Nhân viên',
      value: `${payload.employeeName} (${payload.employeeCode || ''})`,
      inline: true,
    })
  }

  if (payload.branchName) {
    fields.push({
      name: 'Chi nhánh',
      value: payload.branchName,
      inline: true,
    })
  }

  if (payload.lateMinutes !== undefined) {
    fields.push({
      name: 'Số phút muộn',
      value: `${payload.lateMinutes} phút`,
      inline: true,
    })
  }

  if (payload.ipAddress) {
    fields.push({
      name: 'Địa chỉ IP',
      value: payload.ipAddress,
      inline: true,
    })
  }

  return {
    username: 'Smart Attendance Bot',
    avatar_url: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
    embeds: [
      {
        title: eventMeta.label,
        description: payload.message || payload.title || `Sự kiện phát sinh lúc ${new Date().toLocaleTimeString('vi-VN')}`,
        color,
        fields,
        footer: {
          text: 'Smart Attendance System • Webhook Integration',
        },
        timestamp: new Date().toISOString(),
      },
    ],
  }
}

export interface DeliveryResult {
  isSuccess: boolean
  responseStatus: number | null
  responseBody: string | null
  durationMs: number
  errorMessage: string | null
}

/**
 * Gửi webhook đến một subscription cụ thể và ghi lại Delivery Log
 */
export async function deliverWebhook(
  subscription: {
    id: string
    channel: WebhookChannel
    url: string
    secret: string | null
    metadata?: any
  },
  event: string,
  payload: any
): Promise<DeliveryResult> {
  const startTime = Date.now()
  let isSuccess = false
  let responseStatus: number | null = null
  let responseBody: string | null = null
  let errorMessage: string | null = null

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 7000) // Timeout 7s

    let requestUrl = subscription.url
    let requestBody: any = null
    const headers: Record<string, string> = {
      'User-Agent': 'SmartAttendance-Webhook-Dispatcher/2.5',
    }

    if (subscription.channel === WebhookChannel.TELEGRAM) {
      // Telegram Bot API: URL có thể là https://api.telegram.org/bot<token>/sendMessage
      // hoặc subscription.url chứa token và metadata chứa chatId
      const chatId = subscription.metadata?.chatId
      const text = formatTelegramMessage(event, payload)

      if (chatId) {
        requestUrl = subscription.url.includes('/sendMessage')
          ? subscription.url
          : `${subscription.url.replace(/\/$/, '')}/sendMessage`

        headers['Content-Type'] = 'application/json'
        requestBody = JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
        })
      } else {
        headers['Content-Type'] = 'application/json'
        requestBody = JSON.stringify({ text, parse_mode: 'HTML' })
      }
    } else if (subscription.channel === WebhookChannel.DISCORD) {
      // Discord Webhook
      headers['Content-Type'] = 'application/json'
      requestBody = JSON.stringify(formatDiscordPayload(event, payload))
    } else {
      // GENERIC_WEBHOOK & ZALO_ZNS
      headers['Content-Type'] = 'application/json'
      const envelope = {
        event,
        timestamp: new Date().toISOString(),
        subscriptionId: subscription.id,
        data: payload,
      }
      requestBody = JSON.stringify(envelope)

      if (subscription.secret) {
        const signature = signHmacSha256(requestBody, subscription.secret)
        headers['X-Signature-SHA256'] = signature
      }
      headers['X-Event'] = event
    }

    const response = await fetch(requestUrl, {
      method: 'POST',
      headers,
      body: requestBody,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)
    responseStatus = response.status
    const textResp = await response.text().catch(() => '')
    responseBody = textResp.slice(0, 1000) // Giới hạn 1000 ký tự log

    isSuccess = response.status >= 200 && response.status < 300
    if (!isSuccess) {
      errorMessage = `Server responded with HTTP ${response.status}: ${responseBody}`
    }
  } catch (err: any) {
    isSuccess = false
    errorMessage = err?.name === 'AbortError' ? 'Request timed out after 7000ms' : err?.message || 'Network error'
  }

  const durationMs = Date.now() - startTime

  // Ghi Delivery Log vào DB an toàn
  try {
    await prisma.webhookDeliveryLog.create({
      data: {
        subscriptionId: subscription.id,
        event,
        payload,
        responseStatus,
        responseBody,
        durationMs,
        isSuccess,
        errorMessage,
      },
    })
  } catch (logErr) {
    console.error('Failed to save webhook delivery log:', logErr)
  }

  return {
    isSuccess,
    responseStatus,
    responseBody,
    durationMs,
    errorMessage,
  }
}

/**
 * Phân phát sự kiện Webhook tới tất cả các Subscriptions hợp lệ trong nền (Non-blocking)
 */
export async function dispatchWebhookEvent(
  event: WebhookEventType,
  payload: any,
  branchId?: string | null
) {
  try {
    // Tìm các subscriptions đang kích hoạt
    const subscriptions = await prisma.webhookSubscription.findMany({
      where: {
        isActive: true,
        OR: [
          { events: { has: event } },
          { events: { has: 'ALL' } },
        ],
        AND: [
          branchId
            ? { OR: [{ branchId: null }, { branchId }] }
            : { branchId: null },
        ],
      },
    })

    if (subscriptions.length === 0) {
      return []
    }

    // Gửi song song
    const promises = subscriptions.map((sub) => deliverWebhook(sub, event, payload))
    return await Promise.allSettled(promises)
  } catch (error) {
    console.error(`Failed to dispatch webhook event ${event}:`, error)
    return []
  }
}
