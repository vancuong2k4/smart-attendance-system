import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { UserRole, AuditSeverity, AuditStatus } from '@prisma/client'
import {
  inferAuditSeverity,
  logAuditEvent,
  extractClientIp,
  extractUserAgent,
  AuditActions,
} from '@/lib/audit'

const { mockSession, mockPrisma } = vi.hoisted(() => {
  const prismaMock: any = {
    auditLog: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    employee: {
      findUnique: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
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

import { GET as getAuditLogsHandler } from '@/lib/../app/api/audit-logs/route'
import { GET as getAuditLogDetailHandler } from '@/lib/../app/api/audit-logs/[id]/route'
import { GET as getAuditMetricsHandler } from '@/lib/../app/api/audit-logs/metrics/route'
import { GET as getAuditExportHandler } from '@/lib/../app/api/audit-logs/export/route'

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

describe('Audit Log & Security Monitoring Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Core Service - inferAuditSeverity', () => {
    it('should infer CRITICAL severity for destructive actions', () => {
      expect(inferAuditSeverity('SYSTEM_SETTINGS_RESET')).toBe(AuditSeverity.CRITICAL)
      expect(inferAuditSeverity('BRANCH_DELETED')).toBe(AuditSeverity.CRITICAL)
      expect(inferAuditSeverity('EMPLOYEE_DEACTIVATED')).toBe(AuditSeverity.CRITICAL)
      expect(inferAuditSeverity('SECURITY_LOGIN_FAILED')).toBe(AuditSeverity.CRITICAL)
    })

    it('should infer WARNING severity for updates and rejections', () => {
      expect(inferAuditSeverity('SYSTEM_SETTINGS_UPDATED')).toBe(AuditSeverity.WARNING)
      expect(inferAuditSeverity('ATTENDANCE_ADJUSTMENT_REJECTED')).toBe(AuditSeverity.WARNING)
      expect(inferAuditSeverity('SHIFT_SWAP_REJECTED')).toBe(AuditSeverity.WARNING)
    })

    it('should infer SECURITY severity for auth-related actions', () => {
      expect(inferAuditSeverity('USER_PASSWORD_CHANGE')).toBe(AuditSeverity.SECURITY)
      expect(inferAuditSeverity('AUTH_TOKEN_REVOKED')).toBe(AuditSeverity.SECURITY)
    })

    it('should default to INFO severity for standard operations', () => {
      expect(inferAuditSeverity('ATTENDANCE_CHECK_IN')).toBe(AuditSeverity.INFO)
      expect(inferAuditSeverity('LEAVE_REQUEST_CREATED')).toBe(AuditSeverity.INFO)
    })
  })

  describe('Core Service - logAuditEvent & Request Extractors', () => {
    it('should extract client IP from headers', () => {
      const req = new NextRequest(new URL('http://localhost:3000'), {
        headers: { 'x-forwarded-for': '203.113.152.1, 10.0.0.1' },
      })
      expect(extractClientIp(req)).toBe('203.113.152.1')
    })

    it('should write audit log event to DB safely', async () => {
      mockPrisma.auditLog.create.mockResolvedValueOnce({
        id: 'audit-1',
        action: 'BRANCH_CREATED',
      })

      const res = await logAuditEvent({
        userId: 'admin-1',
        action: 'BRANCH_CREATED',
        entity: 'Branch',
        entityId: 'branch-1',
      })

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'admin-1',
            action: 'BRANCH_CREATED',
            entity: 'Branch',
          }),
        })
      )
      expect(res).toBeDefined()
    })

    it('should catch database errors silently without throwing', async () => {
      mockPrisma.auditLog.create.mockRejectedValueOnce(new Error('DB failure'))
      const res = await logAuditEvent({
        userId: 'admin-1',
        action: 'TEST_ACTION',
        entity: 'Test',
        entityId: 'test-1',
      })
      expect(res).toBeNull()
    })
  })

  describe('GET /api/audit-logs', () => {
    it('should return 401 when unauthenticated', async () => {
      mockSession.mockResolvedValueOnce(null)
      const req = createJsonRequest('/api/audit-logs')
      const res = await getAuditLogsHandler(req)
      expect(res.status).toBe(401)
    })

    it('should return 403 when user is an EMPLOYEE or HR_MANAGER', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'emp-1', role: UserRole.EMPLOYEE },
      })
      const req = createJsonRequest('/api/audit-logs')
      const res = await getAuditLogsHandler(req)
      expect(res.status).toBe(403)
    })

    it('should return list of audit logs with pagination for SUPER_ADMIN', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'admin-1', role: UserRole.SUPER_ADMIN },
      })

      mockPrisma.auditLog.count.mockResolvedValueOnce(1)
      mockPrisma.auditLog.findMany.mockResolvedValueOnce([
        {
          id: 'log-1',
          userId: 'admin-1',
          action: 'SYSTEM_SETTINGS_UPDATED',
          entity: 'SystemSetting',
          entityId: 'setting-1',
          severity: AuditSeverity.WARNING,
          status: AuditStatus.SUCCESS,
          ipAddress: '192.168.1.1',
          userAgent: 'Chrome',
          oldData: { gracePeriodMinutes: 10 },
          newData: { gracePeriodMinutes: 15 },
          createdAt: new Date('2026-11-14T08:00:00Z'),
          user: {
            id: 'admin-1',
            email: 'admin@system.com',
            role: UserRole.SUPER_ADMIN,
            employee: null,
          },
        },
      ])

      const req = createJsonRequest('/api/audit-logs?page=1&limit=20')
      const res = await getAuditLogsHandler(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.items.length).toBe(1)
      expect(body.data.items[0].action).toBe('SYSTEM_SETTINGS_UPDATED')
      expect(body.data.items[0].hasDiff).toBe(true)
      expect(body.data.pagination.total).toBe(1)
    })

    it('should scope logs to branch for BRANCH_ADMIN', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'branch-admin-1', role: UserRole.BRANCH_ADMIN },
      })
      mockPrisma.employee.findUnique.mockResolvedValueOnce({
        branchId: 'branch-hn',
      })
      mockPrisma.auditLog.count.mockResolvedValueOnce(0)
      mockPrisma.auditLog.findMany.mockResolvedValueOnce([])

      const req = createJsonRequest('/api/audit-logs')
      const res = await getAuditLogsHandler(req)
      expect(res.status).toBe(200)
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            user: { employee: { branchId: 'branch-hn' } },
          }),
        })
      )
    })
  })

  describe('GET /api/audit-logs/[id]', () => {
    it('should return 404 when log does not exist', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'admin-1', role: UserRole.SUPER_ADMIN },
      })
      mockPrisma.auditLog.findUnique.mockResolvedValueOnce(null)

      const req = createJsonRequest('/api/audit-logs/non-existent')
      const res = await getAuditLogDetailHandler(req, {
        params: Promise.resolve({ id: 'non-existent' }),
      })
      expect(res.status).toBe(404)
    })

    it('should return log detail with state changes for SUPER_ADMIN', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'admin-1', role: UserRole.SUPER_ADMIN },
      })
      mockPrisma.auditLog.findUnique.mockResolvedValueOnce({
        id: 'log-1',
        userId: 'admin-1',
        action: 'BRANCH_UPDATED',
        entity: 'Branch',
        entityId: 'branch-1',
        severity: AuditSeverity.WARNING,
        status: AuditStatus.SUCCESS,
        ipAddress: '127.0.0.1',
        userAgent: 'Firefox',
        oldData: { name: 'Chi nhánh Cũ' },
        newData: { name: 'Chi nhánh Mới' },
        createdAt: new Date(),
        user: {
          id: 'admin-1',
          email: 'admin@system.com',
          role: UserRole.SUPER_ADMIN,
          employee: null,
        },
      })

      const req = createJsonRequest('/api/audit-logs/log-1')
      const res = await getAuditLogDetailHandler(req, {
        params: Promise.resolve({ id: 'log-1' }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.id).toBe('log-1')
      expect(body.data.oldData.name).toBe('Chi nhánh Cũ')
      expect(body.data.newData.name).toBe('Chi nhánh Mới')
    })
  })

  describe('GET /api/audit-logs/metrics', () => {
    it('should return security and audit summary metrics', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'admin-1', role: UserRole.SUPER_ADMIN },
      })
      mockPrisma.auditLog.count
        .mockResolvedValueOnce(150) // total
        .mockResolvedValueOnce(25) // last 24h
        .mockResolvedValueOnce(5) // critical
        .mockResolvedValueOnce(12) // warning

      mockPrisma.auditLog.groupBy
        .mockResolvedValueOnce([
          { action: 'ATTENDANCE_CHECK_IN', _count: { id: 80 } },
        ])
        .mockResolvedValueOnce([
          { userId: 'user-1', _count: { id: 45 } },
        ])

      mockPrisma.auditLog.findMany.mockResolvedValueOnce([
        { createdAt: new Date(), severity: AuditSeverity.INFO },
      ])
      mockPrisma.user.findMany.mockResolvedValueOnce([
        {
          id: 'user-1',
          email: 'user1@company.com',
          role: UserRole.SUPER_ADMIN,
          employee: { fullName: 'Nguyễn Quản Trị' },
        },
      ])

      const req = createJsonRequest('/api/audit-logs/metrics')
      const res = await getAuditMetricsHandler(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.summary.totalEvents).toBe(150)
      expect(body.data.summary.last24hEvents).toBe(25)
      expect(body.data.topActors.length).toBe(1)
      expect(body.data.topActors[0].fullName).toBe('Nguyễn Quản Trị')
    })
  })

  describe('GET /api/audit-logs/export', () => {
    it('should export audit logs in CSV format with UTF-8 BOM', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'admin-1', role: UserRole.SUPER_ADMIN, email: 'admin@system.com' },
      })
      mockPrisma.auditLog.findMany.mockResolvedValueOnce([
        {
          id: 'log-1',
          action: 'BRANCH_CREATED',
          entity: 'Branch',
          entityId: 'branch-1',
          severity: AuditSeverity.INFO,
          status: AuditStatus.SUCCESS,
          ipAddress: '10.0.0.1',
          userAgent: 'Chrome',
          createdAt: new Date('2026-11-14T08:00:00Z'),
          user: {
            email: 'admin@system.com',
            role: UserRole.SUPER_ADMIN,
            employee: null,
          },
        },
      ])

      const req = createJsonRequest('/api/audit-logs/export?format=csv')
      const res = await getAuditExportHandler(req)
      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toContain('text/csv')
      const text = await res.text()
      expect(text).toContain('BRANCH_CREATED')
      expect(text).toContain('Tạo chi nhánh mới')
    })

    it('should export audit logs in JSON format', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'admin-1', role: UserRole.SUPER_ADMIN, email: 'admin@system.com' },
      })
      mockPrisma.auditLog.findMany.mockResolvedValueOnce([
        {
          id: 'log-1',
          action: 'SYSTEM_SETTINGS_RESET',
          entity: 'SystemSetting',
          entityId: 'set-1',
          severity: AuditSeverity.CRITICAL,
          status: AuditStatus.SUCCESS,
          createdAt: new Date(),
          user: null,
        },
      ])

      const req = createJsonRequest('/api/audit-logs/export?format=json')
      const res = await getAuditExportHandler(req)
      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toContain('application/json')
      const json = await res.json()
      expect(json.exportMeta.totalRecords).toBe(1)
      expect(json.records[0].action).toBe('SYSTEM_SETTINGS_RESET')
    })
  })
})
