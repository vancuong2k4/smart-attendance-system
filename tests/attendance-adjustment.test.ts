import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import {
  validateAdjustmentTimes,
  calculateAdjustmentWorkMetrics,
  getAdjustmentTypeLabel,
  getAdjustmentStatusLabel,
  combineDateAndTimeString,
  applyAttendanceAdjustment,
  rejectAttendanceAdjustment,
  cancelAttendanceAdjustment,
} from '@/lib/attendance-adjustment'

const { mockSession, mockPrisma } = vi.hoisted(() => {
  const prismaMock: any = {
    employee: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    attendanceRecord: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    attendanceAdjustment: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    notification: {
      create: vi.fn(),
      createMany: vi.fn(),
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

import { GET as getAdjustmentsHandler, POST as postAdjustmentsHandler } from '../src/app/api/attendance/adjustments/route'
import { GET as getAdjustmentDetailHandler, DELETE as deleteAdjustmentHandler } from '../src/app/api/attendance/adjustments/[id]/route'
import { PATCH as approveAdjustmentHandler } from '../src/app/api/attendance/adjustments/[id]/approve/route'

describe('Attendance Adjustment Feature', () => {
  const mockSchedule = {
    startTime: '08:00',
    endTime: '17:00',
    lunchStart: '12:00',
    lunchEnd: '13:00',
    lateThreshold: 15,
    earlyThreshold: 15,
  }

  const mockEmployeeUser = {
    user: {
      id: 'usr_emp1',
      email: 'emp1@company.com',
      role: 'EMPLOYEE',
      employee: {
        id: 'emp_1',
        branchId: 'br_hn',
      },
    },
  }

  const mockBranchAdminUser = {
    user: {
      id: 'usr_admin_hn',
      email: 'admin_hn@company.com',
      role: 'BRANCH_ADMIN',
      employee: {
        id: 'emp_admin_hn',
        branchId: 'br_hn',
      },
    },
  }

  const mockSuperAdminUser = {
    user: {
      id: 'usr_super',
      email: 'super@company.com',
      role: 'SUPER_ADMIN',
      employee: {
        id: 'emp_super',
        branchId: 'br_hn',
      },
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockSession.mockResolvedValue(mockEmployeeUser)
  })

  // ========================================================
  // 1. UNIT TESTS: BUSINESS LOGIC & TIME VALIDATION
  // ========================================================
  describe('Business Logic & Helper Functions', () => {
    it('combineDateAndTimeString chuyển đổi ngày và giờ VN sang UTC Date chuẩn', () => {
      const date = combineDateAndTimeString('2026-11-12', '08:30')
      expect(date).toBeInstanceOf(Date)
      expect(date.toISOString()).toBe('2026-11-12T01:30:00.000Z')
    })

    it('validateAdjustmentTimes từ chối nếu không cung cấp cả 2 mốc giờ', () => {
      const result = validateAdjustmentTimes(null, null)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Cần cung cấp ít nhất một mốc giờ')
    })

    it('validateAdjustmentTimes từ chối nếu requestedCheckOut <= requestedCheckIn', () => {
      const checkIn = new Date('2026-11-12T10:00:00Z')
      const checkOut = new Date('2026-11-12T09:00:00Z')
      const result = validateAdjustmentTimes(checkIn, checkOut)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('phải sau thời gian check-in')
    })

    it('validateAdjustmentTimes chấp nhận khi chỉ cung cấp check-in hoặc check-out hợp lệ', () => {
      const checkIn = new Date('2026-11-12T01:00:00Z')
      expect(validateAdjustmentTimes(checkIn, null).valid).toBe(true)
      expect(validateAdjustmentTimes(null, checkIn).valid).toBe(true)
    })

    it('calculateAdjustmentWorkMetrics tính đúng 8h làm việc và 1 công sau khi trừ 1h nghỉ trưa', () => {
      // 08:00 VN = 01:00 UTC, 17:00 VN = 10:00 UTC
      const checkIn = new Date('2026-11-12T01:00:00.000Z')
      const checkOut = new Date('2026-11-12T10:00:00.000Z')

      const metrics = calculateAdjustmentWorkMetrics(checkIn, checkOut, mockSchedule)
      expect(metrics.workDuration).toBe(8)
      expect(metrics.workDays).toBe(1)
      expect(metrics.isLate).toBe(false)
      expect(metrics.isEarlyLeave).toBe(false)
      expect(metrics.status).toBe('PRESENT')
    })

    it('calculateAdjustmentWorkMetrics tính đúng nửa ngày công (HALF_DAY) khi làm 4 tiếng', () => {
      // 08:00 VN = 01:00 UTC, 12:00 VN = 05:00 UTC
      const checkIn = new Date('2026-11-12T01:00:00.000Z')
      const checkOut = new Date('2026-11-12T05:00:00.000Z')

      const metrics = calculateAdjustmentWorkMetrics(checkIn, checkOut, mockSchedule)
      expect(metrics.workDuration).toBe(4)
      expect(metrics.workDays).toBe(0.5)
      expect(metrics.status).toBe('HALF_DAY')
    })

    it('getAdjustmentTypeLabel và getAdjustmentStatusLabel trả về nhãn tiếng Việt chuẩn', () => {
      expect(getAdjustmentTypeLabel('FORGOT_CHECKIN')).toBe('Quên check-in')
      expect(getAdjustmentTypeLabel('FORGOT_CHECKOUT')).toBe('Quên check-out')
      expect(getAdjustmentTypeLabel('FORGOT_BOTH')).toBe('Quên cả check-in và check-out')
      expect(getAdjustmentTypeLabel('GPS_ERROR')).toBe('Lỗi định vị GPS')
      expect(getAdjustmentTypeLabel('BUSINESS_OUTSIDE')).toBe('Đi công tác ngoài văn phòng')

      expect(getAdjustmentStatusLabel('PENDING').label).toBe('Chờ duyệt')
      expect(getAdjustmentStatusLabel('APPROVED').label).toBe('Đã duyệt')
      expect(getAdjustmentStatusLabel('REJECTED').label).toBe('Đã từ chối')
      expect(getAdjustmentStatusLabel('CANCELLED').label).toBe('Đã hủy')
    })
  })

  // ========================================================
  // 2. API ENDPOINTS: POST /api/attendance/adjustments
  // ========================================================
  describe('POST /api/attendance/adjustments', () => {
    it('trả về 401 nếu chưa đăng nhập', async () => {
      mockSession.mockResolvedValue(null)
      const req = new NextRequest('http://localhost:3000/api/attendance/adjustments', {
        method: 'POST',
        body: JSON.stringify({}),
      })
      const res = await postAdjustmentsHandler(req)
      expect(res.status).toBe(401)
    })

    it('trả về 422 nếu dữ liệu không hợp lệ (lý do dưới 5 ký tự)', async () => {
      const req = new NextRequest('http://localhost:3000/api/attendance/adjustments', {
        method: 'POST',
        body: JSON.stringify({
          date: '2026-11-10',
          type: 'FORGOT_CHECKIN',
          requestedCheckIn: '08:00',
          reason: 'abc', // < 5 ký tự
        }),
      })
      const res = await postAdjustmentsHandler(req)
      const json = await res.json()
      expect(res.status).toBe(422)
      expect(json.success).toBe(false)
    })

    it('trả về 400 nếu ngày giải trình là ngày trong tương lai', async () => {
      const req = new NextRequest('http://localhost:3000/api/attendance/adjustments', {
        method: 'POST',
        body: JSON.stringify({
          date: '2099-01-01',
          type: 'FORGOT_CHECKIN',
          requestedCheckIn: '08:00',
          reason: 'Quên check in sáng',
        }),
      })
      const res = await postAdjustmentsHandler(req)
      const json = await res.json()
      expect(res.status).toBe(400)
      expect(json.message).toContain('ngày trong tương lai')
    })

    it('trả về 400 nếu đã có đơn PENDING cho ngày đó', async () => {
      mockPrisma.attendanceAdjustment.findFirst.mockResolvedValue({
        id: 'adj_pending_1',
        status: 'PENDING',
      })

      const req = new NextRequest('http://localhost:3000/api/attendance/adjustments', {
        method: 'POST',
        body: JSON.stringify({
          date: '2026-11-10',
          type: 'FORGOT_CHECKIN',
          requestedCheckIn: '08:00',
          reason: 'Đi gặp khách hàng quên chấm công',
        }),
      })
      const res = await postAdjustmentsHandler(req)
      const json = await res.json()
      expect(res.status).toBe(400)
      expect(json.message).toContain('đang chờ duyệt')
    })

    it('tạo đơn giải trình thành công và trả về 201', async () => {
      mockPrisma.attendanceAdjustment.findFirst.mockResolvedValue(null)
      mockPrisma.attendanceAdjustment.create.mockResolvedValue({
        id: 'adj_new_1',
        employeeId: 'emp_1',
        date: new Date('2026-11-10T00:00:00Z'),
        type: 'FORGOT_BOTH',
        status: 'PENDING',
        reason: 'Hết pin điện thoại cả ngày',
        employee: {
          id: 'emp_1',
          fullName: 'Nguyễn Văn A',
          employeeCode: 'NV001',
          branchId: 'br_hn',
        },
      })

      const req = new NextRequest('http://localhost:3000/api/attendance/adjustments', {
        method: 'POST',
        body: JSON.stringify({
          date: '2026-11-10',
          type: 'FORGOT_BOTH',
          requestedCheckIn: '08:00',
          requestedCheckOut: '17:00',
          reason: 'Hết pin điện thoại cả ngày',
        }),
      })
      const res = await postAdjustmentsHandler(req)
      const json = await res.json()

      expect(res.status).toBe(201)
      expect(json.success).toBe(true)
      expect(json.data.id).toBe('adj_new_1')
      expect(mockPrisma.attendanceAdjustment.create).toHaveBeenCalled()
    })
  })

  // ========================================================
  // 3. API ENDPOINTS: GET /api/attendance/adjustments (RBAC)
  // ========================================================
  describe('GET /api/attendance/adjustments', () => {
    it('Employee chỉ tra cứu được đơn giải trình của bản thân', async () => {
      mockPrisma.attendanceAdjustment.count.mockResolvedValue(1)
      mockPrisma.attendanceAdjustment.findMany.mockResolvedValue([])

      const req = new NextRequest('http://localhost:3000/api/attendance/adjustments?employeeId=other_emp')
      await getAdjustmentsHandler(req)

      expect(mockPrisma.attendanceAdjustment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ employeeId: 'emp_1' }),
        })
      )
    })

    it('Branch Admin chỉ xem được đơn của nhân viên cùng chi nhánh', async () => {
      mockSession.mockResolvedValue(mockBranchAdminUser)
      mockPrisma.attendanceAdjustment.count.mockResolvedValue(3)
      mockPrisma.attendanceAdjustment.findMany.mockResolvedValue([])

      const req = new NextRequest('http://localhost:3000/api/attendance/adjustments')
      await getAdjustmentsHandler(req)

      expect(mockPrisma.attendanceAdjustment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            employee: { branchId: 'br_hn' },
          }),
        })
      )
    })

    it('Super Admin có thể xem toàn bộ đơn và lọc theo branchId', async () => {
      mockSession.mockResolvedValue(mockSuperAdminUser)
      mockPrisma.attendanceAdjustment.count.mockResolvedValue(5)
      mockPrisma.attendanceAdjustment.findMany.mockResolvedValue([])

      const req = new NextRequest('http://localhost:3000/api/attendance/adjustments?branchId=br_sg')
      await getAdjustmentsHandler(req)

      expect(mockPrisma.attendanceAdjustment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            employee: { branchId: 'br_sg' },
          }),
        })
      )
    })
  })

  // ========================================================
  // 4. API ENDPOINTS: PATCH /api/attendance/adjustments/[id]/approve
  // ========================================================
  describe('PATCH /api/attendance/adjustments/[id]/approve', () => {
    it('trả về 403 nếu tài khoản role EMPLOYEE cố tình phê duyệt', async () => {
      mockSession.mockResolvedValue(mockEmployeeUser)
      const req = new NextRequest('http://localhost:3000/api/attendance/adjustments/adj_1/approve', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'APPROVED' }),
      })
      const res = await approveAdjustmentHandler(req, {
        params: Promise.resolve({ id: 'adj_1' }),
      })
      expect(res.status).toBe(403)
    })

    it('trả về 404 nếu đơn giải trình không tồn tại', async () => {
      mockSession.mockResolvedValue(mockBranchAdminUser)
      mockPrisma.attendanceAdjustment.findUnique.mockResolvedValue(null)

      const req = new NextRequest('http://localhost:3000/api/attendance/adjustments/adj_nonexistent/approve', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'APPROVED' }),
      })
      const res = await approveAdjustmentHandler(req, {
        params: Promise.resolve({ id: 'adj_nonexistent' }),
      })
      expect(res.status).toBe(404)
    })

    it('trả về 403 nếu Branch Admin phê duyệt nhân viên thuộc chi nhánh khác', async () => {
      mockSession.mockResolvedValue(mockBranchAdminUser)
      mockPrisma.attendanceAdjustment.findUnique.mockResolvedValue({
        id: 'adj_sg_1',
        status: 'PENDING',
        employee: { id: 'emp_sg', branchId: 'br_sg' }, // chi nhánh khác br_hn
      })

      const req = new NextRequest('http://localhost:3000/api/attendance/adjustments/adj_sg_1/approve', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'APPROVED' }),
      })
      const res = await approveAdjustmentHandler(req, {
        params: Promise.resolve({ id: 'adj_sg_1' }),
      })
      expect(res.status).toBe(403)
    })

    it('duyệt đơn giải trình thành công, cập nhật AttendanceRecord với MANUAL và isManualEntry = true', async () => {
      mockSession.mockResolvedValue(mockBranchAdminUser)

      const mockAdjustment = {
        id: 'adj_valid_1',
        employeeId: 'emp_1',
        date: new Date('2026-11-10T00:00:00Z'),
        type: 'FORGOT_BOTH',
        requestedCheckIn: new Date('2026-11-10T01:00:00Z'),
        requestedCheckOut: new Date('2026-11-10T10:00:00Z'),
        reason: 'Quên chấm công cả ngày',
        status: 'PENDING',
        employee: {
          id: 'emp_1',
          fullName: 'Nguyễn Văn A',
          branchId: 'br_hn',
          branch: {
            schedules: [mockSchedule],
          },
        },
      }

      mockPrisma.attendanceAdjustment.findUnique.mockResolvedValue(mockAdjustment)
      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null)
      mockPrisma.attendanceAdjustment.update.mockResolvedValue({
        ...mockAdjustment,
        status: 'APPROVED',
      })
      mockPrisma.attendanceRecord.upsert.mockResolvedValue({
        id: 'rec_1',
        employeeId: 'emp_1',
        status: 'PRESENT',
        workDuration: 8,
        workDays: 1,
        isManualEntry: true,
        checkInMethod: 'MANUAL',
      })
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit_1' })

      const req = new NextRequest('http://localhost:3000/api/attendance/adjustments/adj_valid_1/approve', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'APPROVED' }),
      })
      const res = await approveAdjustmentHandler(req, {
        params: Promise.resolve({ id: 'adj_valid_1' }),
      })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data.attendanceRecord.isManualEntry).toBe(true)
      expect(mockPrisma.attendanceRecord.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            isManualEntry: true,
            checkInMethod: 'MANUAL',
            status: 'PRESENT',
          }),
        })
      )
    })

    it('từ chối đơn giải trình thành công kèm rejectReason', async () => {
      mockSession.mockResolvedValue(mockBranchAdminUser)
      const mockAdjustment = {
        id: 'adj_reject_1',
        employeeId: 'emp_1',
        date: new Date('2026-11-10T00:00:00Z'),
        type: 'GPS_ERROR',
        status: 'PENDING',
        employee: {
          id: 'emp_1',
          fullName: 'Nguyễn Văn A',
          branchId: 'br_hn',
        },
      }

      mockPrisma.attendanceAdjustment.findUnique.mockResolvedValue(mockAdjustment)
      mockPrisma.attendanceAdjustment.update.mockResolvedValue({
        ...mockAdjustment,
        status: 'REJECTED',
        rejectReason: 'Không có minh chứng hợp lệ',
      })
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit_2' })

      const req = new NextRequest('http://localhost:3000/api/attendance/adjustments/adj_reject_1/approve', {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'REJECTED',
          rejectReason: 'Không có minh chứng hợp lệ',
        }),
      })
      const res = await approveAdjustmentHandler(req, {
        params: Promise.resolve({ id: 'adj_reject_1' }),
      })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data.adjustment.status).toBe('REJECTED')
    })
  })

  // ========================================================
  // 5. API ENDPOINTS: DELETE /api/attendance/adjustments/[id]
  // ========================================================
  describe('DELETE /api/attendance/adjustments/[id]', () => {
    it('trả về 403 nếu nhân viên cố hủy đơn của người khác', async () => {
      mockSession.mockResolvedValue(mockEmployeeUser)
      mockPrisma.attendanceAdjustment.findUnique.mockResolvedValue({
        id: 'adj_other',
        employeeId: 'emp_other',
        status: 'PENDING',
      })

      const req = new NextRequest('http://localhost:3000/api/attendance/adjustments/adj_other', {
        method: 'DELETE',
      })
      const res = await deleteAdjustmentHandler(req, {
        params: Promise.resolve({ id: 'adj_other' }),
      })
      expect(res.status).toBe(403)
    })

    it('trả về 400 nếu đơn không còn ở trạng thái PENDING', async () => {
      mockSession.mockResolvedValue(mockEmployeeUser)
      mockPrisma.attendanceAdjustment.findUnique.mockResolvedValue({
        id: 'adj_done',
        employeeId: 'emp_1',
        status: 'APPROVED',
      })

      const req = new NextRequest('http://localhost:3000/api/attendance/adjustments/adj_done', {
        method: 'DELETE',
      })
      const res = await deleteAdjustmentHandler(req, {
        params: Promise.resolve({ id: 'adj_done' }),
      })
      expect(res.status).toBe(400)
    })

    it('chính chủ nhân viên hủy đơn PENDING thành công', async () => {
      mockSession.mockResolvedValue(mockEmployeeUser)
      mockPrisma.attendanceAdjustment.findUnique.mockResolvedValue({
        id: 'adj_to_cancel',
        employeeId: 'emp_1',
        status: 'PENDING',
      })
      mockPrisma.attendanceAdjustment.update.mockResolvedValue({
        id: 'adj_to_cancel',
        status: 'CANCELLED',
      })

      const req = new NextRequest('http://localhost:3000/api/attendance/adjustments/adj_to_cancel', {
        method: 'DELETE',
      })
      const res = await deleteAdjustmentHandler(req, {
        params: Promise.resolve({ id: 'adj_to_cancel' }),
      })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(mockPrisma.attendanceAdjustment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'CANCELLED' },
        })
      )
    })
  })
})
