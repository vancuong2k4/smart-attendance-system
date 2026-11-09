import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockSession, mockPrisma } = vi.hoisted(() => {
  return {
    mockSession: vi.fn(),
    mockPrisma: {
      branch: {
        findMany: vi.fn(),
      },
      employee: {
        findMany: vi.fn(),
      },
      attendanceRecord: {
        findMany: vi.fn(),
      },
      leaveRequest: {
        findMany: vi.fn(),
      },
      overtimeRequest: {
        findMany: vi.fn(),
      },
    },
  }
})

vi.mock('@/lib/auth', () => ({
  auth: () => mockSession(),
}))

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

import { GET as getSummaryHandler } from '../src/app/api/reports/summary/route'
import { GET as getPayrollExportHandler } from '../src/app/api/reports/payroll-export/route'

describe('Reports & Payroll Export API Routes', () => {
  const sampleBranch = {
    id: 'br_hn',
    name: 'Chi nhánh Hà Nội',
    code: 'HN',
  }

  const sampleEmployee = {
    id: 'emp_1',
    employeeCode: 'NV001',
    fullName: 'Nguyễn Văn A',
    branchId: 'br_hn',
    department: { name: 'Kỹ thuật' },
    branch: { name: 'Chi nhánh Hà Nội' },
    startDate: new Date('2023-01-01'),
    endDate: null,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockSession.mockResolvedValue({
      user: {
        id: 'usr_hr',
        email: 'hr@demo.com',
        role: 'HR_MANAGER',
        employee: { id: 'emp_hr', branchId: 'br_hn' },
      },
    })
  })

  describe('GET /api/reports/summary', () => {
    it('từ chối truy cập đối với EMPLOYEE (403)', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr_emp', role: 'EMPLOYEE' },
      })

      const req = new NextRequest('http://localhost:3000/api/reports/summary?year=2024&month=1')
      const res = await getSummaryHandler(req)
      const json = await res.json()

      expect(res.status).toBe(403)
      expect(json.success).toBe(false)
    })

    it('tính toán và trả về đúng cấu trúc báo cáo tổng hợp', async () => {
      mockPrisma.branch.findMany.mockResolvedValue([sampleBranch])
      mockPrisma.employee.findMany.mockResolvedValue([sampleEmployee])
      mockPrisma.attendanceRecord.findMany.mockResolvedValue([
        { employeeId: 'emp_1', workDays: 1, isLate: true, status: 'PRESENT' },
        { employeeId: 'emp_1', workDays: 1, isLate: false, status: 'PRESENT' },
      ])
      mockPrisma.overtimeRequest.findMany.mockResolvedValue([
        { employeeId: 'emp_1', hours: 3 },
      ])

      const req = new NextRequest('http://localhost:3000/api/reports/summary?year=2024&month=1')
      const res = await getSummaryHandler(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data.period).toEqual({ year: 2024, month: 1 })
      expect(json.data.summary.totalWorkdays).toBe(23)
      expect(json.data.summary.totalEmployees).toBe(1)
      expect(json.data.summary.totalLate).toBe(1)
      expect(json.data.summary.totalOTHours).toBe(3)
      expect(json.data.byBranch).toHaveLength(1)
      expect(json.data.byBranch[0].branchCode).toBe('HN')
    })
  })

  describe('GET /api/reports/payroll-export', () => {
    it('từ chối vai trò BRANCH_ADMIN khi xuất bảng lương (403)', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'adm_hn', role: 'BRANCH_ADMIN' },
      })

      const req = new NextRequest('http://localhost:3000/api/reports/payroll-export?year=2024&month=1')
      const res = await getPayrollExportHandler(req)
      const json = await res.json()

      expect(res.status).toBe(403)
      expect(json.success).toBe(false)
    })

    it('xuất định dạng JSON với đầy đủ các trường chuẩn', async () => {
      mockPrisma.employee.findMany.mockResolvedValue([sampleEmployee])
      mockPrisma.attendanceRecord.findMany.mockResolvedValue([
        { employeeId: 'emp_1', date: '2024-01-02', workDays: 1, isLate: false, status: 'PRESENT' },
      ])
      mockPrisma.leaveRequest.findMany.mockResolvedValue([])
      mockPrisma.overtimeRequest.findMany.mockResolvedValue([])

      const req = new NextRequest(
        'http://localhost:3000/api/reports/payroll-export?year=2024&month=1&format=json'
      )
      const res = await getPayrollExportHandler(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(Array.isArray(json)).toBe(true)
      expect(json).toHaveLength(1)
      expect(json[0]).toHaveProperty('employee_code', 'NV001')
      expect(json[0]).toHaveProperty('employee_name', 'Nguyễn Văn A')
      expect(json[0]).toHaveProperty('department', 'Kỹ thuật')
      expect(json[0]).toHaveProperty('branch', 'Chi nhánh Hà Nội')
      expect(json[0]).toHaveProperty('work_days', 1)
      expect(json[0]).toHaveProperty('absent_days')
      expect(json[0]).toHaveProperty('paid_leave_days')
      expect(json[0]).toHaveProperty('late_count', 0)
      expect(json[0]).toHaveProperty('ot_hours', 0)
      expect(json[0]).toHaveProperty('period_start', '2024-01-01')
      expect(json[0]).toHaveProperty('period_end', '2024-01-31')
    })

    it('xuất định dạng CSV với header BOM UTF-8', async () => {
      mockPrisma.employee.findMany.mockResolvedValue([sampleEmployee])
      mockPrisma.attendanceRecord.findMany.mockResolvedValue([])
      mockPrisma.leaveRequest.findMany.mockResolvedValue([])
      mockPrisma.overtimeRequest.findMany.mockResolvedValue([])

      const req = new NextRequest(
        'http://localhost:3000/api/reports/payroll-export?year=2024&month=1&format=csv'
      )
      const res = await getPayrollExportHandler(req)
      const buffer = Buffer.from(await res.arrayBuffer())

      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toContain('text/csv')
      expect(buffer[0]).toBe(0xef)
      expect(buffer[1]).toBe(0xbb)
      expect(buffer[2]).toBe(0xbf)
      expect(buffer.toString('utf-8')).toContain('NV001')
    })

    it('xuất định dạng Excel (.xlsx)', async () => {
      mockPrisma.employee.findMany.mockResolvedValue([sampleEmployee])
      mockPrisma.attendanceRecord.findMany.mockResolvedValue([])
      mockPrisma.leaveRequest.findMany.mockResolvedValue([])
      mockPrisma.overtimeRequest.findMany.mockResolvedValue([])

      const req = new NextRequest(
        'http://localhost:3000/api/reports/payroll-export?year=2024&month=1&format=xlsx'
      )
      const res = await getPayrollExportHandler(req)
      const buffer = await res.arrayBuffer()

      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toContain(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
      expect(buffer.byteLength).toBeGreaterThan(0)
    })

    it('trả về 400 nếu truyền format không được hỗ trợ', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/reports/payroll-export?year=2024&month=1&format=pdf'
      )
      const res = await getPayrollExportHandler(req)
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.success).toBe(false)
      expect(json.message).toContain('Định dạng không được hỗ trợ')
    })

    it('trả về 400 nếu truyền tháng không hợp lệ (month=13)', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/reports/payroll-export?year=2024&month=13&format=json'
      )
      const res = await getPayrollExportHandler(req)
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.success).toBe(false)
      expect(json.message).toContain('Tháng không hợp lệ')
    })
  })
})
