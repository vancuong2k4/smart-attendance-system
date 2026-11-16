import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import {
  UserRole,
  ContractType,
  ContractStatus,
  LifecycleStage,
} from '@prisma/client'
import {
  calculateDaysRemaining,
  computeContractStatus,
  getExpirationUrgency,
  recordLifecycleEvent,
} from '@/lib/contracts'
import {
  contractCreateSchema,
  contractUpdateSchema,
} from '@/lib/contract-validation'

const { mockSession, mockPrisma } = vi.hoisted(() => {
  const prismaMock: any = {
    employmentContract: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    lifecycleEvent: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    employee: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
    webhookSubscription: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    webhookDeliveryLog: {
      create: vi.fn(),
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

import {
  GET as getContractsHandler,
  POST as postContractsHandler,
} from '@/app/api/contracts/route'
import {
  GET as getContractByIdHandler,
  PATCH as patchContractHandler,
  DELETE as deleteContractHandler,
} from '@/app/api/contracts/[id]/route'
import { GET as getContractMetricsHandler } from '@/app/api/contracts/metrics/route'
import { GET as getEmployeeTimelineHandler } from '@/app/api/employees/[id]/timeline/route'
import { POST as postCheckExpiringHandler } from '@/app/api/contracts/check-expiring/route'

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

describe('Employment Contracts & HR Lifecycle Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // 1. Core Logic & Calculation Engine
  describe('Core Contract Engine & Calculators', () => {
    it('calculateDaysRemaining calculates correct diff between dates', () => {
      const now = new Date('2026-11-17T00:00:00Z')
      const targetIn10Days = new Date('2026-11-27T00:00:00Z')
      const pastDate = new Date('2026-11-10T00:00:00Z')

      expect(calculateDaysRemaining(targetIn10Days, now)).toBe(10)
      expect(calculateDaysRemaining(pastDate, now)).toBe(-7)
      expect(calculateDaysRemaining(null, now)).toBeNull()
    })

    it('computeContractStatus accurately categorizes contract status', () => {
      const now = new Date('2026-11-17T00:00:00Z')

      // Terminated or Draft stays raw status
      expect(computeContractStatus(ContractStatus.TERMINATED, null, now)).toBe(
        ContractStatus.TERMINATED
      )
      expect(computeContractStatus(ContractStatus.DRAFT, null, now)).toBe(
        ContractStatus.DRAFT
      )

      // Indefinite contract (null endDate) remains ACTIVE
      expect(computeContractStatus(ContractStatus.ACTIVE, null, now)).toBe(
        ContractStatus.ACTIVE
      )

      // Far future (> 30 days) remains ACTIVE
      const farFuture = new Date('2027-01-01T00:00:00Z')
      expect(computeContractStatus(ContractStatus.ACTIVE, farFuture, now)).toBe(
        ContractStatus.ACTIVE
      )

      // Expiring soon (15 days <= 30)
      const in15Days = new Date('2026-12-02T00:00:00Z')
      expect(computeContractStatus(ContractStatus.ACTIVE, in15Days, now)).toBe(
        ContractStatus.EXPIRING_SOON
      )

      // Expired (< 0 days)
      const past = new Date('2026-11-01T00:00:00Z')
      expect(computeContractStatus(ContractStatus.ACTIVE, past, now)).toBe(
        ContractStatus.EXPIRED
      )
    })

    it('getExpirationUrgency assigns correct risk urgency', () => {
      expect(getExpirationUrgency(-5)).toBe('CRITICAL')
      expect(getExpirationUrgency(3)).toBe('CRITICAL')
      expect(getExpirationUrgency(14)).toBe('CRITICAL')
      expect(getExpirationUrgency(25)).toBe('WARNING')
      expect(getExpirationUrgency(60)).toBe('NORMAL')
      expect(getExpirationUrgency(null)).toBe('INDEFINITE')
    })

    it('recordLifecycleEvent creates a lifecycleEvent in prisma database', async () => {
      mockPrisma.lifecycleEvent.create.mockResolvedValue({ id: 'evt-1' })

      await recordLifecycleEvent(
        {
          employeeId: 'emp-101',
          stage: LifecycleStage.OFFICIAL,
          title: 'Ký hợp đồng chính thức',
          description: 'Hợp đồng số HDLD-2026-001',
          createdById: 'usr-admin',
          metadata: { contractId: 'ctr-1' },
        },
        mockPrisma
      )

      expect(mockPrisma.lifecycleEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            employeeId: 'emp-101',
            stage: LifecycleStage.OFFICIAL,
            title: 'Ký hợp đồng chính thức',
          }),
        })
      )
    })
  })

  // 2. Validation Schemas
  describe('Zod Validation Schemas', () => {
    it('validates a correct contract creation payload', () => {
      const validPayload = {
        contractNumber: 'HDLD-202611-1234',
        employeeId: 'emp-123',
        contractType: ContractType.DEFINITE_TERM,
        status: ContractStatus.ACTIVE,
        jobTitle: 'Senior Frontend Engineer',
        signDate: '2026-11-17',
        startDate: '2026-11-20',
        endDate: '2027-11-19',
        grossSalary: 25000000,
        insuranceSalary: 10000000,
        workingHoursPerWeek: 40,
        signerName: 'Nguyễn Văn Giám Đốc',
      }

      const result = contractCreateSchema.safeParse(validPayload)
      expect(result.success).toBe(true)
    })

    it('rejects contract creation with missing contractNumber or invalid dates', () => {
      const invalidPayload = {
        contractNumber: 'HD', // min 3 chars
        employeeId: '',
        contractType: 'UNKNOWN_TYPE',
        startDate: 'invalid-date-string',
      }

      const result = contractCreateSchema.safeParse(invalidPayload)
      expect(result.success).toBe(false)
    })
  })

  // 3. API Endpoints: Contracts CRUD
  describe('GET & POST /api/contracts', () => {
    it('returns 401 when unauthenticated', async () => {
      mockSession.mockResolvedValue(null)
      const req = createJsonRequest('/api/contracts')
      const res = await getContractsHandler(req)
      const data = await res.json()

      expect(res.status).toBe(401)
      expect(data.success).toBe(false)
    })

    it('SUPER_ADMIN can retrieve contracts with pagination and calculated status', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr-admin', role: UserRole.SUPER_ADMIN },
      })

      const mockContractsList = [
        {
          id: 'c-1',
          contractNumber: 'HDLD-2026-001',
          contractType: ContractType.DEFINITE_TERM,
          status: ContractStatus.ACTIVE,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-11-25'), // expiring in 8 days
          grossSalary: 20000000,
          employee: {
            id: 'emp-1',
            fullName: 'Nguyen Van A',
            employeeCode: 'EMP001',
            branch: { id: 'b-1', name: 'Chi nhánh Hà Nội' },
          },
        },
      ]

      mockPrisma.employmentContract.count.mockResolvedValue(1)
      mockPrisma.employmentContract.findMany.mockResolvedValue(mockContractsList)

      const req = createJsonRequest('/api/contracts?page=1&limit=10')
      const res = await getContractsHandler(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data.items).toHaveLength(1)
      expect(json.data.items[0].computedStatus).toBe(ContractStatus.EXPIRING_SOON)
      expect(json.data.items[0].daysRemaining).toBeLessThanOrEqual(30)
    })

    it('EMPLOYEE role only queries contracts for their own employee profile', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr-emp', role: UserRole.EMPLOYEE },
      })

      mockPrisma.employee.findUnique.mockResolvedValue({ id: 'emp-self' })
      mockPrisma.employmentContract.count.mockResolvedValue(0)
      mockPrisma.employmentContract.findMany.mockResolvedValue([])

      const req = createJsonRequest('/api/contracts')
      const res = await getContractsHandler(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(mockPrisma.employmentContract.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            employeeId: 'emp-self',
          }),
        })
      )
    })

    it('rejects POST /api/contracts when role is EMPLOYEE (403 forbidden)', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr-emp', role: UserRole.EMPLOYEE },
      })

      const req = createJsonRequest('/api/contracts', 'POST', {
        contractNumber: 'HDLD-001',
      })
      const res = await postContractsHandler(req)
      const json = await res.json()

      expect(res.status).toBe(403)
      expect(json.success).toBe(false)
    })

    it('creates contract and logs lifecycle event on valid POST by HR_MANAGER', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr-hr', role: UserRole.HR_MANAGER },
      })

      mockPrisma.employee.findUnique.mockResolvedValue({
        id: 'emp-10',
        branchId: 'b-1',
        fullName: 'Le Thi B',
      })
      mockPrisma.employmentContract.findUnique.mockResolvedValue(null) // No existing contractNumber
      mockPrisma.employmentContract.create.mockResolvedValue({
        id: 'ctr-new',
        contractNumber: 'HDLD-202611-9999',
        contractType: ContractType.PROBATION,
        employeeId: 'emp-10',
        grossSalary: 12000000,
        startDate: new Date('2026-11-20'),
        endDate: new Date('2027-01-20'),
        employee: {
          id: 'emp-10',
          fullName: 'Le Thi B',
          employeeCode: 'EMP010',
          branch: { id: 'b-1', name: 'Chi nhánh HCM' },
        },
      })
      mockPrisma.lifecycleEvent.create.mockResolvedValue({ id: 'evt-created' })

      const req = createJsonRequest('/api/contracts', 'POST', {
        contractNumber: 'HDLD-202611-9999',
        employeeId: 'emp-10',
        contractType: ContractType.PROBATION,
        jobTitle: 'Chuyên viên Marketing',
        signDate: '2026-11-17',
        startDate: '2026-11-20',
        endDate: '2027-01-20',
        grossSalary: 12000000,
        insuranceSalary: 6000000,
        workingHoursPerWeek: 40,
      })

      const res = await postContractsHandler(req)
      const json = await res.json()

      expect(res.status).toBe(201)
      expect(json.success).toBe(true)
      expect(mockPrisma.employmentContract.create).toHaveBeenCalled()
      expect(mockPrisma.lifecycleEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            employeeId: 'emp-10',
            stage: LifecycleStage.PROBATION,
          }),
        })
      )
    })
  })

  // 4. API Endpoints: Single Contract By ID
  describe('/api/contracts/[id]', () => {
    it('GET /api/contracts/[id] returns contract with computed status', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr-admin', role: UserRole.SUPER_ADMIN },
      })

      mockPrisma.employmentContract.findUnique.mockResolvedValue({
        id: 'ctr-55',
        contractNumber: 'HDLD-202611-0055',
        contractType: ContractType.DEFINITE_TERM,
        status: ContractStatus.ACTIVE,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-01'), // expiring in 14 days
        grossSalary: 18000000,
        employee: {
          id: 'emp-55',
          fullName: 'Tran Van C',
          branch: { id: 'b-1', name: 'HN' },
        },
      })

      const req = createJsonRequest('/api/contracts/ctr-55')
      const res = await getContractByIdHandler(req, {
        params: Promise.resolve({ id: 'ctr-55' }),
      })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data.computedStatus).toBe(ContractStatus.EXPIRING_SOON)
      expect(json.data.daysRemaining).toBeLessThanOrEqual(30)
    })

    it('PATCH /api/contracts/[id] tracks salary promotion lifecycle event when salary increased', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr-admin', role: UserRole.SUPER_ADMIN },
      })

      mockPrisma.employmentContract.findUnique.mockResolvedValue({
        id: 'ctr-55',
        employeeId: 'emp-55',
        grossSalary: 18000000,
        jobTitle: 'Kỹ sư phần mềm',
        status: ContractStatus.ACTIVE,
        employee: { branchId: 'b-1', fullName: 'Tran Van C' },
      })

      mockPrisma.employmentContract.update.mockResolvedValue({
        id: 'ctr-55',
        employeeId: 'emp-55',
        grossSalary: 24000000,
        jobTitle: 'Kỹ sư phần mềm cấp cao',
        status: ContractStatus.ACTIVE,
        employee: {
          id: 'emp-55',
          fullName: 'Tran Van C',
          branch: { id: 'b-1', name: 'HN' },
        },
      })

      const req = createJsonRequest('/api/contracts/ctr-55', 'PATCH', {
        grossSalary: 24000000,
        jobTitle: 'Kỹ sư phần mềm cấp cao',
      })
      const res = await patchContractHandler(req, {
        params: Promise.resolve({ id: 'ctr-55' }),
      })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(mockPrisma.lifecycleEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            employeeId: 'emp-55',
            stage: LifecycleStage.PROMOTION,
          }),
        })
      )
    })

    it('DELETE /api/contracts/[id] terminates the contract', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr-admin', role: UserRole.SUPER_ADMIN },
      })

      mockPrisma.employmentContract.findUnique.mockResolvedValue({
        id: 'ctr-55',
        employeeId: 'emp-55',
        employee: { branchId: 'b-1', fullName: 'Tran Van C' },
      })
      mockPrisma.employmentContract.delete.mockResolvedValue({
        id: 'ctr-55',
      })

      const req = createJsonRequest('/api/contracts/ctr-55', 'DELETE')
      const res = await deleteContractHandler(req, {
        params: Promise.resolve({ id: 'ctr-55' }),
      })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(mockPrisma.employmentContract.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ctr-55' },
        })
      )
    })
  })

  // 5. Metrics & Analytics
  describe('GET /api/contracts/metrics', () => {
    it('aggregates total, active, probation and expiring contracts', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr-admin', role: UserRole.SUPER_ADMIN },
      })

      const now = new Date()
      const futureIn10Days = new Date(now.getTime() + 10 * 86400000)
      const futureIn60Days = new Date(now.getTime() + 60 * 86400000)

      mockPrisma.employmentContract.findMany.mockResolvedValue([
        {
          id: 'c-1',
          contractType: ContractType.PROBATION,
          status: ContractStatus.ACTIVE,
          startDate: now,
          endDate: futureIn10Days, // probation and expiring soon
        },
        {
          id: 'c-2',
          contractType: ContractType.DEFINITE_TERM,
          status: ContractStatus.ACTIVE,
          startDate: now,
          endDate: futureIn60Days, // active, not expiring soon
        },
      ])

      const req = createJsonRequest('/api/contracts/metrics')
      const res = await getContractMetricsHandler(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.data.totalContracts).toBe(2)
      expect(json.data.probationContracts).toBe(1)
      expect(json.data.expiringSoonContracts).toBe(1)
    })
  })

  // 6. Employee Lifecycle Timeline
  describe('GET /api/employees/[id]/timeline', () => {
    it('returns timeline events sorted by date', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr-admin', role: UserRole.SUPER_ADMIN },
      })

      mockPrisma.employee.findUnique.mockResolvedValue({
        id: 'emp-101',
        fullName: 'Hoang Van D',
        employeeCode: 'EMP101',
        branchId: 'b-1',
      })

      mockPrisma.lifecycleEvent.findMany.mockResolvedValue([
        {
          id: 'evt-2',
          stage: LifecycleStage.OFFICIAL,
          title: 'Ký hợp đồng chính thức',
          eventDate: new Date('2026-03-01'),
        },
        {
          id: 'evt-1',
          stage: LifecycleStage.ONBOARDING,
          title: 'Tiếp nhận nhân sự',
          eventDate: new Date('2026-01-01'),
        },
      ])

      const req = createJsonRequest('/api/employees/emp-101/timeline')
      const res = await getEmployeeTimelineHandler(req, {
        params: Promise.resolve({ id: 'emp-101' }),
      })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.data.events).toHaveLength(2)
      expect(json.data.employee.fullName).toBe('Hoang Van D')
    })
  })

  // 7. Expiring Scanner & Webhook Alert Dispatcher
  describe('POST /api/contracts/check-expiring', () => {
    it('scans contracts expiring in 30 days and dispatches alerts', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr-admin', role: UserRole.SUPER_ADMIN },
      })

      const in20Days = new Date(Date.now() + 20 * 86400000)

      mockPrisma.employmentContract.findMany.mockResolvedValue([
        {
          id: 'c-exp',
          contractNumber: 'HDLD-EXP-01',
          endDate: in20Days,
          employee: {
            id: 'emp-exp',
            fullName: 'Nguyen Thi E',
            employeeCode: 'EMP050',
            branchId: 'b-1',
            branch: { name: 'Hà Nội' },
          },
        },
      ])

      const req = createJsonRequest('/api/contracts/check-expiring', 'POST', {
        daysThreshold: 30,
        sendNotifications: true,
        dispatchWebhooks: true,
      })

      const res = await postCheckExpiringHandler(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data.totalExpiring).toBe(1)
      expect(json.data.items[0].contractNumber).toBe('HDLD-EXP-01')
      expect(mockPrisma.notification.create).toHaveBeenCalled()
    })
  })
})
