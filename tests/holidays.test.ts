import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { UserRole, HolidayType } from '@prisma/client'
import {
  getVietnameseNationalHolidays,
  isDateInRange,
  findHolidayForDate,
  calculateDatePayMultiplier,
  calculateActualWorkingDaysInMonth,
} from '@/lib/holidays'
import {
  holidayCreateSchema,
  holidayUpdateSchema,
} from '@/lib/holiday-validation'

const { mockSession, mockPrisma } = vi.hoisted(() => {
  const prismaMock: any = {
    companyHoliday: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
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
  GET as getHolidaysHandler,
  POST as postHolidaysHandler,
} from '@/app/api/holidays/route'
import {
  GET as getHolidayByIdHandler,
  PATCH as patchHolidayHandler,
  DELETE as deleteHolidayHandler,
} from '@/app/api/holidays/[id]/route'
import { POST as postInitDefaultsHandler } from '@/app/api/holidays/init-defaults/route'
import { GET as getHolidayCheckHandler } from '@/app/api/holidays/check/route'
import { GET as getHolidaySummaryHandler } from '@/app/api/holidays/summary/route'
import { POST as postBroadcastHolidayHandler } from '@/app/api/holidays/broadcast/route'

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

describe('Company Holiday Calendar & Special Multipliers Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // 1. Core Logic & Calculations
  describe('Core Holiday Engine & Pay Multiplier Logic', () => {
    it('getVietnameseNationalHolidays returns official Vietnamese national holidays', () => {
      const holidays2026 = getVietnameseNationalHolidays(2026)
      expect(holidays2026.length).toBeGreaterThanOrEqual(6)

      const codes = holidays2026.map((h) => h.code)
      expect(codes).toContain('NEW_YEAR_2026')
      expect(codes).toContain('LUNAR_NEW_YEAR_2026')
      expect(codes).toContain('VICTORY_DAY_2026')
      expect(codes).toContain('LABOR_DAY_2026')
      expect(codes).toContain('NATIONAL_DAY_2026')
      expect(codes).toContain('HUNG_KINGS_2026')

      // All national holidays have 300% multiplier
      holidays2026.forEach((h) => {
        expect(h.payMultiplier).toBe(3.0)
        expect(h.isPaid).toBe(true)
      })
    })

    it('isDateInRange correctly identifies dates within start and end date', () => {
      expect(isDateInRange('2026-04-30', '2026-04-30')).toBe(true)
      expect(isDateInRange('2026-05-01', '2026-04-30')).toBe(false)
      expect(isDateInRange('2026-02-18', '2026-02-15', '2026-02-21')).toBe(true)
      expect(isDateInRange('2026-02-22', '2026-02-15', '2026-02-21')).toBe(false)
    })

    it('findHolidayForDate respects branchId scoping', () => {
      const mockHolidays = [
        {
          id: 'h-all',
          name: 'Nghỉ lễ toàn công ty',
          date: new Date('2026-01-01'),
          branchId: null,
        },
        {
          id: 'h-hn',
          name: 'Kỷ niệm chi nhánh Hà Nội',
          date: new Date('2026-10-10'),
          branchId: 'b-hn',
        },
      ]

      // All-company holiday matches any branch
      expect(findHolidayForDate('2026-01-01', mockHolidays, 'b-hcm')?.id).toBe('h-all')
      expect(findHolidayForDate('2026-01-01', mockHolidays, null)?.id).toBe('h-all')

      // Branch-scoped holiday matches only its branch
      expect(findHolidayForDate('2026-10-10', mockHolidays, 'b-hn')?.id).toBe('h-hn')
      expect(findHolidayForDate('2026-10-10', mockHolidays, 'b-hcm')).toBeNull()
    })

    it('calculateDatePayMultiplier returns appropriate multipliers', () => {
      const mockHolidays = [
        {
          id: 'h-tet',
          name: 'Tết Dương Lịch',
          type: HolidayType.NATIONAL,
          date: new Date('2026-01-01'), // Thứ 5
          payMultiplier: 3.0,
        },
        {
          id: 'h-comp',
          name: 'Làm bù thứ 7',
          type: HolidayType.COMPENSATORY_WORK,
          date: new Date('2026-01-10'), // Thứ 7 làm bù
          payMultiplier: 1.0,
        },
      ]

      // 1. National holiday -> 3.0 (300%)
      const resHoliday = calculateDatePayMultiplier('2026-01-01', mockHolidays)
      expect(resHoliday.multiplier).toBe(3.0)
      expect(resHoliday.isHoliday).toBe(true)
      expect(resHoliday.isCompensatory).toBe(false)

      // 2. Compensatory work on Saturday -> 1.0 (100%)
      const resComp = calculateDatePayMultiplier('2026-01-10', mockHolidays)
      expect(resComp.multiplier).toBe(1.0)
      expect(resComp.isHoliday).toBe(false)
      expect(resComp.isCompensatory).toBe(true)

      // 3. Regular Sunday without holiday -> 2.0 (200% weekend OT)
      const resSunday = calculateDatePayMultiplier('2026-01-04', mockHolidays)
      expect(resSunday.multiplier).toBe(2.0)
      expect(resSunday.isWeekend).toBe(true)

      // 4. Regular Saturday without holiday -> 1.5 (150%)
      const resSaturday = calculateDatePayMultiplier('2026-01-17', mockHolidays)
      expect(resSaturday.multiplier).toBe(1.5)
      expect(resSaturday.isWeekend).toBe(true)

      // 5. Regular weekday -> 1.0 (100%)
      const resWeekday = calculateDatePayMultiplier('2026-01-05', mockHolidays)
      expect(resWeekday.multiplier).toBe(1.0)
      expect(resWeekday.isWeekend).toBe(false)
    })

    it('calculateActualWorkingDaysInMonth calculates standard vs actual work days correctly', () => {
      // Tháng 1/2026 có 31 ngày, bắt đầu từ Thứ Năm.
      // Ngày 01/01/2026 là Thứ 5 (Nghỉ Tết Dương Lịch - hưởng lương).
      // Giả sử có 1 ngày làm bù vào Thứ 7 (10/01/2026).
      const mockHolidays = [
        {
          id: 'h-1',
          name: 'Tết Dương lịch',
          type: HolidayType.NATIONAL,
          date: new Date('2026-01-01'),
          isPaid: true,
        },
        {
          id: 'h-comp',
          name: 'Làm bù',
          type: HolidayType.COMPENSATORY_WORK,
          date: new Date('2026-01-10'), // Thứ 7
        },
      ]

      const summary = calculateActualWorkingDaysInMonth(2026, 1, mockHolidays)
      expect(summary.standardWorkDays).toBe(22)
      expect(summary.holidayDays).toBe(1)
      expect(summary.compensatoryDays).toBe(1)
      // Actual = 22 - 1 + 1 = 22
      expect(summary.actualWorkDays).toBe(22)
    })
  })

  // 2. Validation Schemas
  describe('Zod Validation Schemas', () => {
    it('validates a valid holiday creation payload', () => {
      const valid = {
        name: 'Kỷ niệm thành lập Công ty',
        code: 'COMPANY_ANNIVERSARY_2026',
        date: '2026-06-15',
        type: HolidayType.COMPANY,
        isPaid: true,
        payMultiplier: 2.0,
        year: 2026,
      }
      expect(holidayCreateSchema.safeParse(valid).success).toBe(true)
    })

    it('rejects invalid holiday code with special characters or invalid multiplier', () => {
      const invalid = {
        name: 'Lễ',
        code: 'INVALID CODE with spaces & $#',
        date: 'invalid-date',
        type: 'INVALID_TYPE',
        payMultiplier: 10.0, // max 5.0
      }
      expect(holidayCreateSchema.safeParse(invalid).success).toBe(false)
    })
  })

  // 3. API Endpoints: CRUD
  describe('/api/holidays CRUD Endpoints', () => {
    it('GET /api/holidays returns 401 when unauthenticated', async () => {
      mockSession.mockResolvedValue(null)
      const req = createJsonRequest('/api/holidays')
      const res = await getHolidaysHandler(req)
      expect(res.status).toBe(401)
    })

    it('GET /api/holidays retrieves holidays for specified year', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr-admin', role: UserRole.SUPER_ADMIN },
      })

      mockPrisma.companyHoliday.count.mockResolvedValue(1)
      mockPrisma.companyHoliday.findMany.mockResolvedValue([
        {
          id: 'h-1',
          name: 'Quốc khánh',
          code: 'NATIONAL_DAY_2026',
          date: new Date('2026-09-02'),
          type: HolidayType.NATIONAL,
          payMultiplier: 3.0,
          isPaid: true,
          year: 2026,
        },
      ])

      const req = createJsonRequest('/api/holidays?year=2026')
      const res = await getHolidaysHandler(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data.items).toHaveLength(1)
      expect(json.data.items[0].code).toBe('NATIONAL_DAY_2026')
    })

    it('POST /api/holidays rejects EMPLOYEE role (403 forbidden)', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr-emp', role: UserRole.EMPLOYEE },
      })

      const req = createJsonRequest('/api/holidays', 'POST', {
        name: 'Nghỉ riêng',
      })
      const res = await postHolidaysHandler(req)
      expect(res.status).toBe(403)
    })

    it('POST /api/holidays creates holiday successfully by SUPER_ADMIN', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr-admin', role: UserRole.SUPER_ADMIN },
      })

      mockPrisma.companyHoliday.findFirst.mockResolvedValue(null)
      mockPrisma.companyHoliday.create.mockResolvedValue({
        id: 'h-new',
        name: 'Year End Party',
        code: 'YEP_2026',
        date: new Date('2026-12-31'),
        type: HolidayType.COMPANY,
        payMultiplier: 2.0,
        isPaid: true,
        year: 2026,
      })

      const req = createJsonRequest('/api/holidays', 'POST', {
        name: 'Year End Party',
        code: 'YEP_2026',
        date: '2026-12-31',
        type: HolidayType.COMPANY,
        payMultiplier: 2.0,
        isPaid: true,
        year: 2026,
      })
      const res = await postHolidaysHandler(req)
      const json = await res.json()

      expect(res.status).toBe(201)
      expect(json.success).toBe(true)
      expect(mockPrisma.companyHoliday.create).toHaveBeenCalled()
      expect(mockPrisma.auditLog.create).toHaveBeenCalled()
    })

    it('GET /api/holidays/[id] returns detail of holiday', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr-admin', role: UserRole.SUPER_ADMIN },
      })

      mockPrisma.companyHoliday.findUnique.mockResolvedValue({
        id: 'h-100',
        name: 'Giỗ Tổ Hùng Vương',
        code: 'HUNG_KINGS_2026',
        type: HolidayType.NATIONAL,
        payMultiplier: 3.0,
        date: new Date('2026-04-26'),
      })

      const req = createJsonRequest('/api/holidays/h-100')
      const res = await getHolidayByIdHandler(req, {
        params: Promise.resolve({ id: 'h-100' }),
      })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.data.code).toBe('HUNG_KINGS_2026')
    })

    it('PATCH /api/holidays/[id] updates holiday', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr-admin', role: UserRole.SUPER_ADMIN },
      })

      mockPrisma.companyHoliday.findUnique.mockResolvedValue({
        id: 'h-100',
        name: 'Giỗ Tổ Hùng Vương',
        type: HolidayType.NATIONAL,
      })
      mockPrisma.companyHoliday.update.mockResolvedValue({
        id: 'h-100',
        name: 'Giỗ Tổ Hùng Vương (Cập nhật)',
        type: HolidayType.NATIONAL,
      })

      const req = createJsonRequest('/api/holidays/h-100', 'PATCH', {
        name: 'Giỗ Tổ Hùng Vương (Cập nhật)',
      })
      const res = await patchHolidayHandler(req, {
        params: Promise.resolve({ id: 'h-100' }),
      })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.data.name).toBe('Giỗ Tổ Hùng Vương (Cập nhật)')
    })

    it('DELETE /api/holidays/[id] deletes holiday', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr-admin', role: UserRole.SUPER_ADMIN },
      })

      mockPrisma.companyHoliday.findUnique.mockResolvedValue({
        id: 'h-100',
        name: 'Giỗ Tổ Hùng Vương',
      })
      mockPrisma.companyHoliday.delete.mockResolvedValue({ id: 'h-100' })

      const req = createJsonRequest('/api/holidays/h-100', 'DELETE')
      const res = await deleteHolidayHandler(req, {
        params: Promise.resolve({ id: 'h-100' }),
      })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(mockPrisma.companyHoliday.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'h-100' } })
      )
    })
  })

  // 4. Init Defaults & Checking Endpoints
  describe('Specialized Endpoints (Init, Check, Summary, Broadcast)', () => {
    it('POST /api/holidays/init-defaults seeds national holidays', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr-admin', role: UserRole.SUPER_ADMIN },
      })

      mockPrisma.companyHoliday.findFirst.mockResolvedValue(null)
      mockPrisma.companyHoliday.create.mockResolvedValue({ id: 'created' })

      const req = createJsonRequest('/api/holidays/init-defaults', 'POST', {
        year: 2026,
      })
      const res = await postInitDefaultsHandler(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data.total).toBeGreaterThanOrEqual(6)
    })

    it('GET /api/holidays/check evaluates pay multiplier for a specific date', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr-admin', role: UserRole.SUPER_ADMIN },
      })

      mockPrisma.companyHoliday.findMany.mockResolvedValue([
        {
          id: 'h-304',
          name: 'Giải phóng miền Nam (30/4)',
          date: new Date('2026-04-30'),
          type: HolidayType.NATIONAL,
          payMultiplier: 3.0,
        },
      ])

      const req = createJsonRequest('/api/holidays/check?date=2026-04-30')
      const res = await getHolidayCheckHandler(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.data.isHoliday).toBe(true)
      expect(json.data.multiplier).toBe(3.0)
    })

    it('GET /api/holidays/summary returns aggregated counts and monthly work days', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr-admin', role: UserRole.SUPER_ADMIN },
      })

      mockPrisma.companyHoliday.findMany.mockResolvedValue([
        {
          id: 'h-1',
          type: HolidayType.NATIONAL,
          date: new Date('2026-05-01'),
          isPaid: true,
        },
      ])

      const req = createJsonRequest('/api/holidays/summary?year=2026&month=5')
      const res = await getHolidaySummaryHandler(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.data.nationalCount).toBe(1)
      expect(json.data.workingDaysMonth).toBeDefined()
    })

    it('POST /api/holidays/broadcast sends notifications to employees and dispatches webhooks', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr-admin', role: UserRole.SUPER_ADMIN },
      })

      mockPrisma.companyHoliday.findUnique.mockResolvedValue({
        id: 'h-broadcast',
        name: 'Nghỉ Tết Nguyên Đán 2026',
        code: 'TET_2026',
        date: new Date('2026-02-15'),
        endDate: new Date('2026-02-21'),
        type: HolidayType.NATIONAL,
        payMultiplier: 3.0,
        isPaid: true,
      })

      mockPrisma.employee.findMany.mockResolvedValue([
        { id: 'emp-1' },
        { id: 'emp-2' },
      ])
      mockPrisma.notification.create.mockResolvedValue({ id: 'notif-1' })

      const req = createJsonRequest('/api/holidays/broadcast', 'POST', {
        holidayId: 'h-broadcast',
        customMessage: 'Thông báo lịch nghỉ Tết 7 ngày của công ty.',
        sendInApp: true,
        sendWebhooks: true,
      })
      const res = await postBroadcastHolidayHandler(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data.notifiedEmployeesCount).toBe(2)
      expect(mockPrisma.notification.create).toHaveBeenCalledTimes(2)
    })
  })
})
