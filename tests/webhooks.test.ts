import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { UserRole, WebhookChannel } from '@prisma/client'
import {
  signHmacSha256,
  formatTelegramMessage,
  formatDiscordPayload,
  deliverWebhook,
  dispatchWebhookEvent,
  WebhookEvents,
} from '@/lib/webhooks'

const { mockSession, mockPrisma } = vi.hoisted(() => {
  const prismaMock: any = {
    webhookSubscription: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    webhookDeliveryLog: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    employee: {
      findUnique: vi.fn(),
    },
  }

  return {
    mockSession: vi.fn(),
    mockPrisma: prismaMock,
  }
})

vi.mock('@/lib/auth', () => ({
  auth: () => mockSession(),
}))

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

import { GET as getWebhooksHandler, POST as postWebhooksHandler } from '@/lib/../app/api/webhooks/route'
import {
  GET as getWebhookDetailHandler,
  PATCH as patchWebhookHandler,
  DELETE as deleteWebhookHandler,
} from '@/lib/../app/api/webhooks/[id]/route'
import { POST as postTestWebhookHandler } from '@/lib/../app/api/webhooks/[id]/test/route'
import { GET as getWebhookDeliveriesHandler } from '@/lib/../app/api/webhooks/[id]/deliveries/route'

function createJsonRequest(url: string, method = 'GET', body?: any): NextRequest {
  const init: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body !== undefined) {
    init.body = JSON.stringify(body)
  }
  return new NextRequest(new URL(url, 'http://localhost:3000'), init)
}

describe('Webhooks & Multi-Channel Notifications Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  describe('Core Formatters & HMAC Signature', () => {
    it('should generate valid HMAC-SHA256 signature', () => {
      const payload = JSON.stringify({ test: 'hello' })
      const secret = 'super-secret-key'
      const sig1 = signHmacSha256(payload, secret)
      const sig2 = signHmacSha256(payload, secret)
      expect(sig1).toBe(sig2)
      expect(sig1.length).toBe(64) // 256 bits = 64 hex chars
    })

    it('should format Telegram HTML messages for check-in and late alerts', () => {
      const checkInMsg = formatTelegramMessage(WebhookEvents.ATTENDANCE_CHECK_IN, {
        employeeName: 'Nguyễn Văn A',
        employeeCode: 'EMP001',
        branchName: 'Chi nhánh 1',
        time: '08:00',
        distanceMeters: 25,
      })
      expect(checkInMsg).toContain('CHẤM CÔNG VÀO CA')
      expect(checkInMsg).toContain('Nguyễn Văn A')
      expect(checkInMsg).toContain('25m (Hợp lệ)')

      const lateMsg = formatTelegramMessage(WebhookEvents.ATTENDANCE_LATE_ALERT, {
        employeeName: 'Trần Văn B',
        lateMinutes: 20,
      })
      expect(lateMsg).toContain('CẢNH BÁO ĐI MUỘN')
      expect(lateMsg).toContain('20 phút')
    })

    it('should format Discord Embed payload with colored embeds', () => {
      const discordPayload = formatDiscordPayload(WebhookEvents.ATTENDANCE_CHECK_IN, {
        employeeName: 'Lê Văn C',
        employeeCode: 'EMP003',
        branchName: 'Hà Nội',
      })
      expect(discordPayload.username).toBe('Smart Attendance Bot')
      expect(discordPayload.embeds.length).toBe(1)
      expect(discordPayload.embeds[0].color).toBe(0x10b981) // Green
      expect(discordPayload.embeds[0].fields.length).toBeGreaterThan(0)
    })
  })

  describe('Core Dispatcher - deliverWebhook & dispatchWebhookEvent', () => {
    it('should deliver webhook and record delivery log on success', async () => {
      // Mock global fetch
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        text: () => Promise.resolve('{"ok":true}'),
      })
      vi.stubGlobal('fetch', mockFetch)

      mockPrisma.webhookDeliveryLog.create.mockResolvedValueOnce({ id: 'log-1' })

      const sub = {
        id: 'sub-1',
        channel: WebhookChannel.DISCORD,
        url: 'https://discord.com/api/webhooks/test',
        secret: null,
      }

      const result = await deliverWebhook(sub, WebhookEvents.ATTENDANCE_CHECK_IN, {
        employeeName: 'Test',
      })

      expect(mockFetch).toHaveBeenCalled()
      expect(result.isSuccess).toBe(true)
      expect(result.responseStatus).toBe(200)
      expect(mockPrisma.webhookDeliveryLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subscriptionId: 'sub-1',
            isSuccess: true,
          }),
        })
      )
    })

    it('should query matching active subscriptions and dispatch events', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        text: () => Promise.resolve('OK'),
      })
      vi.stubGlobal('fetch', mockFetch)
      mockPrisma.webhookDeliveryLog.create.mockResolvedValue({ id: 'log-1' })

      mockPrisma.webhookSubscription.findMany.mockResolvedValueOnce([
        {
          id: 'sub-1',
          channel: WebhookChannel.GENERIC_WEBHOOK,
          url: 'https://example.com/webhook',
          secret: 'secret',
          events: [WebhookEvents.ATTENDANCE_CHECK_IN],
          isActive: true,
          branchId: null,
        },
      ])

      const results = await dispatchWebhookEvent(
        WebhookEvents.ATTENDANCE_CHECK_IN,
        { employeeName: 'Nguyen Van A' },
        'branch-1'
      )

      expect(results.length).toBe(1)
      expect(mockPrisma.webhookSubscription.findMany).toHaveBeenCalled()
    })
  })

  describe('GET & POST /api/webhooks', () => {
    it('should return 401 when unauthenticated', async () => {
      mockSession.mockResolvedValueOnce(null)
      const req = createJsonRequest('/api/webhooks')
      const res = await getWebhooksHandler(req)
      expect(res.status).toBe(401)
    })

    it('should return 403 when user is an EMPLOYEE', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'emp-1', role: UserRole.EMPLOYEE },
      })
      const req = createJsonRequest('/api/webhooks')
      const res = await getWebhooksHandler(req)
      expect(res.status).toBe(403)
    })

    it('should return list of webhooks for SUPER_ADMIN', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'admin-1', role: UserRole.SUPER_ADMIN },
      })
      mockPrisma.webhookSubscription.findMany.mockResolvedValueOnce([
        {
          id: 'sub-1',
          name: 'Telegram Bot HN',
          channel: WebhookChannel.TELEGRAM,
          url: 'https://api.telegram.org/bot123/sendMessage',
          secret: null,
          events: [WebhookEvents.ATTENDANCE_CHECK_IN],
          isActive: true,
          branchId: null,
          branch: null,
          metadata: { chatId: '-100123' },
          deliveries: [{ isSuccess: true, createdAt: new Date() }],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])

      const req = createJsonRequest('/api/webhooks')
      const res = await getWebhooksHandler(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.length).toBe(1)
      expect(body.data[0].name).toBe('Telegram Bot HN')
      expect(body.data[0].metrics.successRatePercent).toBe(100)
    })

    it('should create new webhook subscription for SUPER_ADMIN', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'admin-1', role: UserRole.SUPER_ADMIN },
      })

      const newSub = {
        name: 'Discord Kỹ Thuật',
        channel: WebhookChannel.DISCORD,
        url: 'https://discord.com/api/webhooks/123/abc',
        events: [WebhookEvents.ATTENDANCE_CHECK_IN, WebhookEvents.SECURITY_CRITICAL_ALERT],
        isActive: true,
      }

      mockPrisma.webhookSubscription.create.mockResolvedValueOnce({
        id: 'sub-new',
        ...newSub,
        branch: null,
      })

      const req = createJsonRequest('/api/webhooks', 'POST', newSub)
      const res = await postWebhooksHandler(req)
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(mockPrisma.webhookSubscription.create).toHaveBeenCalled()
    })

    it('should return 422 if webhook payload fails validation (invalid url or missing events)', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'admin-1', role: UserRole.SUPER_ADMIN },
      })
      const invalidSub = {
        name: 'Invalid',
        channel: WebhookChannel.GENERIC_WEBHOOK,
        url: 'not-a-valid-url',
        events: [],
      }

      const req = createJsonRequest('/api/webhooks', 'POST', invalidSub)
      const res = await postWebhooksHandler(req)
      expect(res.status).toBe(422)
    })
  })

  describe('PATCH & DELETE /api/webhooks/[id]', () => {
    it('should return 404 when updating non-existent webhook', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'admin-1', role: UserRole.SUPER_ADMIN },
      })
      mockPrisma.webhookSubscription.findUnique.mockResolvedValueOnce(null)

      const req = createJsonRequest('/api/webhooks/not-found', 'PATCH', { name: 'Updated' })
      const res = await patchWebhookHandler(req, {
        params: Promise.resolve({ id: 'not-found' }),
      })
      expect(res.status).toBe(404)
    })

    it('should update webhook successfully', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'admin-1', role: UserRole.SUPER_ADMIN },
      })
      mockPrisma.webhookSubscription.findUnique.mockResolvedValueOnce({ id: 'sub-1' })
      mockPrisma.webhookSubscription.update.mockResolvedValueOnce({
        id: 'sub-1',
        name: 'Tên Đã Đổi',
      })

      const req = createJsonRequest('/api/webhooks/sub-1', 'PATCH', { name: 'Tên Đã Đổi' })
      const res = await patchWebhookHandler(req, {
        params: Promise.resolve({ id: 'sub-1' }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.name).toBe('Tên Đã Đổi')
    })

    it('should delete webhook successfully', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'admin-1', role: UserRole.SUPER_ADMIN },
      })
      mockPrisma.webhookSubscription.findUnique.mockResolvedValueOnce({ id: 'sub-1' })
      mockPrisma.webhookSubscription.delete.mockResolvedValueOnce({ id: 'sub-1' })

      const req = createJsonRequest('/api/webhooks/sub-1', 'DELETE')
      const res = await deleteWebhookHandler(req, {
        params: Promise.resolve({ id: 'sub-1' }),
      })
      expect(res.status).toBe(200)
      expect(mockPrisma.webhookSubscription.delete).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
      })
    })
  })

  describe('POST /api/webhooks/[id]/test & GET deliveries', () => {
    it('should trigger test ping and return delivery status', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'admin-1', role: UserRole.SUPER_ADMIN, email: 'admin@system.com' },
      })
      mockPrisma.webhookSubscription.findUnique.mockResolvedValueOnce({
        id: 'sub-1',
        channel: WebhookChannel.DISCORD,
        url: 'https://discord.com/api/webhooks/test',
        secret: null,
        branch: { name: 'Trụ sở chính' },
      })

      const mockFetch = vi.fn().mockResolvedValue({
        status: 204,
        text: () => Promise.resolve(''),
      })
      vi.stubGlobal('fetch', mockFetch)
      mockPrisma.webhookDeliveryLog.create.mockResolvedValueOnce({ id: 'del-1' })

      const req = createJsonRequest('/api/webhooks/sub-1/test', 'POST')
      const res = await postTestWebhookHandler(req, {
        params: Promise.resolve({ id: 'sub-1' }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.isSuccess).toBe(true)
      expect(body.data.responseStatus).toBe(204)
    })

    it('should return recent deliveries log for subscription', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'admin-1', role: UserRole.SUPER_ADMIN },
      })
      mockPrisma.webhookSubscription.findUnique.mockResolvedValueOnce({
        id: 'sub-1',
        name: 'Telegram Bot',
      })
      mockPrisma.webhookDeliveryLog.findMany.mockResolvedValueOnce([
        {
          id: 'del-1',
          subscriptionId: 'sub-1',
          event: WebhookEvents.ATTENDANCE_CHECK_IN,
          payload: { employeeName: 'A' },
          responseStatus: 200,
          durationMs: 120,
          isSuccess: true,
          createdAt: new Date(),
        },
      ])

      const req = createJsonRequest('/api/webhooks/sub-1/deliveries')
      const res = await getWebhookDeliveriesHandler(req, {
        params: Promise.resolve({ id: 'sub-1' }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.deliveries.length).toBe(1)
      expect(body.data.deliveries[0].event).toBe(WebhookEvents.ATTENDANCE_CHECK_IN)
    })
  })
})
