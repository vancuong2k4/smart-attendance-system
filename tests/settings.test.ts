import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { UserRole } from '@prisma/client'
import {
  companyProfileUpdateSchema,
  systemSettingsUpdateSchema,
} from '@/lib/settings-validation'
import { DEFAULT_SYSTEM_SETTINGS, getOrCreateSystemSettings } from '@/lib/settings'

const { mockSession, mockPrisma } = vi.hoisted(() => {
  const prismaMock: any = {
    company: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    systemSetting: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    branch: {
      count: vi.fn(),
    },
    employee: {
      count: vi.fn(),
    },
    workSchedule: {
      count: vi.fn(),
    },
    department: {
      count: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  }

  prismaMock.$transaction = vi.fn(async (cb) => {
    if (typeof cb === 'function') {
      return cb(prismaMock)
    }
    return Promise.all(cb)
  })

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

// Import route handlers sau khi vi.mock đã hoist
import { GET as getSettingsHandler, PATCH as patchSettingsHandler } from '@/lib/../app/api/settings/route'
import { PATCH as patchCompanyHandler } from '@/lib/../app/api/settings/company/route'
import { POST as postResetHandler } from '@/lib/../app/api/settings/reset/route'
import { GET as getExportHandler } from '@/lib/../app/api/settings/export/route'

function createJsonRequest(url: string, method: string, body?: any): NextRequest {
  const init: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body !== undefined) {
    init.body = JSON.stringify(body)
  }
  return new NextRequest(new URL(url, 'http://localhost:3000'), init)
}

describe('System Settings & Configuration Suite', () => {
  const mockCompany = {
    id: 'company-1',
    name: 'Smart Attendance Enterprise Corp',
    code: 'SAEC',
    taxCode: '0102030405',
    address: 'Tòa nhà Landmark 81, TP. HCM',
    phone: '0901234567',
    email: 'contact@enterprise.com',
    logoUrl: 'https://cdn.example.com/logo.png',
    timezone: 'Asia/Ho_Chi_Minh',
    currency: 'VND',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockSettings = {
    id: 'settings-1',
    companyId: 'company-1',
    ...DEFAULT_SYSTEM_SETTINGS,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.company.findFirst.mockResolvedValue({
      ...mockCompany,
      settings: mockSettings,
    })
    mockPrisma.company.findUnique.mockResolvedValue({
      ...mockCompany,
      settings: mockSettings,
    })
    mockPrisma.systemSetting.findUnique.mockResolvedValue(mockSettings)
    mockPrisma.systemSetting.create.mockResolvedValue(mockSettings)
    mockPrisma.systemSetting.update.mockResolvedValue(mockSettings)
    mockPrisma.company.create.mockResolvedValue(mockCompany)
    mockPrisma.company.update.mockResolvedValue(mockCompany)
    mockPrisma.branch.count.mockResolvedValue(3)
    mockPrisma.employee.count.mockResolvedValue(45)
    mockPrisma.workSchedule.count.mockResolvedValue(5)
    mockPrisma.department.count.mockResolvedValue(4)
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-1' })
  })

  describe('Validation Schemas', () => {
    it('should validate valid company profile data', () => {
      const validData = {
        name: 'Công ty Công nghệ Toàn Cầu',
        taxCode: '0315998877',
        phone: '0988123456',
        email: 'info@globaltech.vn',
        address: '123 Nguyễn Huệ, Q.1, TP.HCM',
        logoUrl: 'https://example.com/logo.png',
        timezone: 'Asia/Ho_Chi_Minh',
        currency: 'VND',
      }
      const res = companyProfileUpdateSchema.safeParse(validData)
      expect(res.success).toBe(true)
    })

    it('should reject invalid email in company profile', () => {
      const invalidData = {
        name: 'Công ty Test',
        email: 'invalid-email-address',
      }
      const res = companyProfileUpdateSchema.safeParse(invalidData)
      expect(res.success).toBe(false)
      if (!res.success) {
        expect(res.error.issues[0].message).toContain('email')
      }
    })

    it('should validate valid system settings update data', () => {
      const validSettings = {
        ...DEFAULT_SYSTEM_SETTINGS,
        defaultLateThreshold: 20,
        requireSelfie: true,
      }
      const res = systemSettingsUpdateSchema.safeParse(validSettings)
      expect(res.success).toBe(true)
    })

    it('should reject negative values for defaultLateThreshold and maxGpsAccuracyMeters out of range', () => {
      const invalidSettings = {
        ...DEFAULT_SYSTEM_SETTINGS,
        defaultLateThreshold: -5,
        maxGpsAccuracyMeters: 5, // min is 10
      }
      const res = systemSettingsUpdateSchema.safeParse(invalidSettings)
      expect(res.success).toBe(false)
    })
  })

  describe('getOrCreateSystemSettings helper', () => {
    it('should return existing company and settings if present', async () => {
      const result = await getOrCreateSystemSettings()
      expect(result.company.id).toBe('company-1')
      expect(result.settings.id).toBe('settings-1')
    })

    it('should create default company and nested settings if company does not exist', async () => {
      mockPrisma.company.findFirst.mockResolvedValueOnce(null)
      const createdCompanyWithSettings = {
        id: 'new-company',
        name: 'Tổng công ty',
        code: 'HQ',
        timezone: 'Asia/Ho_Chi_Minh',
        currency: 'VND',
        settings: {
          id: 'new-nested-setting',
          companyId: 'new-company',
          ...DEFAULT_SYSTEM_SETTINGS,
        },
      }
      mockPrisma.company.create.mockResolvedValueOnce(createdCompanyWithSettings)

      const result = await getOrCreateSystemSettings()
      expect(mockPrisma.company.create).toHaveBeenCalled()
      expect(result.company.id).toBe('new-company')
      expect(result.settings.id).toBe('new-nested-setting')
    })

    it('should create settings if company exists but has no settings record', async () => {
      mockPrisma.company.findFirst.mockResolvedValueOnce({
        id: 'existing-company',
        name: 'Existing Company',
        settings: null,
      })
      mockPrisma.systemSetting.create.mockResolvedValueOnce({
        id: 'new-standalone-setting',
        companyId: 'existing-company',
        ...DEFAULT_SYSTEM_SETTINGS,
      })

      const result = await getOrCreateSystemSettings()
      expect(mockPrisma.systemSetting.create).toHaveBeenCalled()
      expect(result.company.id).toBe('existing-company')
      expect(result.settings.id).toBe('new-standalone-setting')
    })
  })

  describe('GET /api/settings', () => {
    it('should return 401 if unauthenticated', async () => {
      mockSession.mockResolvedValueOnce(null)
      const req = createJsonRequest('/api/settings', 'GET')
      const res = await getSettingsHandler(req)
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.success).toBe(false)
    })

    it('should return 200 with company and settings for logged-in user', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'admin-1', role: UserRole.SUPER_ADMIN, email: 'admin@system.com' },
      })
      const req = createJsonRequest('/api/settings', 'GET')
      const res = await getSettingsHandler(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.company.name).toBe('Smart Attendance Enterprise Corp')
      expect(body.data.settings.defaultLateThreshold).toBe(15)
    })
  })

  describe('PATCH /api/settings', () => {
    it('should return 401 if unauthenticated', async () => {
      mockSession.mockResolvedValueOnce(null)
      const req = createJsonRequest('/api/settings', 'PATCH', { defaultLateThreshold: 10 })
      const res = await patchSettingsHandler(req)
      expect(res.status).toBe(401)
    })

    it('should return 403 if role is not SUPER_ADMIN', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'branch-1', role: UserRole.BRANCH_ADMIN, email: 'branch@system.com' },
      })
      const req = createJsonRequest('/api/settings', 'PATCH', { defaultLateThreshold: 10 })
      const res = await patchSettingsHandler(req)
      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.message).toContain('SUPER_ADMIN')
    })

    it('should return 422 if payload fails validation', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'admin-1', role: UserRole.SUPER_ADMIN, email: 'admin@system.com' },
      })
      const req = createJsonRequest('/api/settings', 'PATCH', { defaultLateThreshold: -10 })
      const res = await patchSettingsHandler(req)
      expect(res.status).toBe(422)
    })

    it('should update settings and create audit log when caller is SUPER_ADMIN', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'admin-1', role: UserRole.SUPER_ADMIN, email: 'admin@system.com' },
      })
      const updatePayload = {
        defaultLateThreshold: 20,
        requireGps: false,
        requireSelfie: true,
      }
      mockPrisma.systemSetting.update.mockResolvedValueOnce({
        ...mockSettings,
        ...updatePayload,
      })

      const req = createJsonRequest('/api/settings', 'PATCH', updatePayload)
      const res = await patchSettingsHandler(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(mockPrisma.systemSetting.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'settings-1' },
          data: updatePayload,
        })
      )
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'admin-1',
            action: 'SYSTEM_SETTINGS_UPDATED',
          }),
        })
      )
    })
  })

  describe('PATCH /api/settings/company', () => {
    it('should return 403 if role is BRANCH_ADMIN or EMPLOYEE', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'emp-1', role: UserRole.EMPLOYEE, email: 'emp@system.com' },
      })
      const req = createJsonRequest('/api/settings/company', 'PATCH', { name: 'New Name' })
      const res = await patchCompanyHandler(req)
      expect(res.status).toBe(403)
    })

    it('should update company info and log audit when caller is SUPER_ADMIN', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'admin-1', role: UserRole.SUPER_ADMIN, email: 'admin@system.com' },
      })
      const payload = {
        name: 'Tập đoàn Công nghệ Mới',
        phone: '0911223344',
        email: 'info@newtech.vn',
        timezone: 'Asia/Ho_Chi_Minh',
        currency: 'VND',
      }
      mockPrisma.company.update.mockResolvedValueOnce({
        ...mockCompany,
        ...payload,
      })

      const req = createJsonRequest('/api/settings/company', 'PATCH', payload)
      const res = await patchCompanyHandler(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(mockPrisma.company.update).toHaveBeenCalled()
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'admin-1',
            action: 'COMPANY_PROFILE_UPDATED',
          }),
        })
      )
    })
  })

  describe('POST /api/settings/reset', () => {
    it('should return 403 if not SUPER_ADMIN', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'user-1', role: UserRole.HR_MANAGER, email: 'hr@system.com' },
      })
      const req = createJsonRequest('/api/settings/reset', 'POST')
      const res = await postResetHandler(req)
      expect(res.status).toBe(403)
    })

    it('should reset settings to DEFAULT_SYSTEM_SETTINGS and record audit log', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'admin-1', role: UserRole.SUPER_ADMIN, email: 'admin@system.com' },
      })
      const req = createJsonRequest('/api/settings/reset', 'POST')
      const res = await postResetHandler(req)
      expect(res.status).toBe(200)
      expect(mockPrisma.systemSetting.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'settings-1' },
          data: DEFAULT_SYSTEM_SETTINGS,
        })
      )
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'admin-1',
            action: 'SYSTEM_SETTINGS_RESET',
          }),
        })
      )
    })
  })

  describe('GET /api/settings/export', () => {
    it('should return 403 if role is EMPLOYEE', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'emp-1', role: UserRole.EMPLOYEE, email: 'emp@system.com' },
      })
      const req = createJsonRequest('/api/settings/export', 'GET')
      const res = await getExportHandler(req)
      expect(res.status).toBe(403)
    })

    it('should return full system diagnostic export for BRANCH_ADMIN or SUPER_ADMIN', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'admin-1', role: UserRole.SUPER_ADMIN, email: 'admin@system.com' },
      })
      const req = createJsonRequest('/api/settings/export', 'GET')
      const res = await getExportHandler(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.system).toBe('Smart Attendance System')
      expect(body.data.metrics.totalBranches).toBe(3)
      expect(body.data.metrics.totalEmployees).toBe(45)
      expect(body.data.organization.name).toBe('Smart Attendance Enterprise Corp')
    })
  })
})
