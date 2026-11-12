import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { UserRole, ShiftSwapStatus, SwapPeerStatus } from '@prisma/client'

const { mockSession, mockPrisma } = vi.hoisted(() => {
  const prismaMock: any = {
    workSchedule: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    shiftAssignment: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    shiftSwapRequest: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    branch: {
      findUnique: vi.fn(),
    },
    employee: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    notification: {
      create: vi.fn(),
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

import {
  calculateShiftDuration,
  isOvernightShift,
  formatWorkDaysLabel,
  validateSwapEligibility,
} from '../src/lib/shift-engine'
import {
  scheduleCreateSchema,
  shiftSwapCreateSchema,
} from '../src/lib/shift-validation'

import {
  GET as getSchedulesHandler,
  POST as postSchedulesHandler,
} from '../src/app/api/schedules/route'
import {
  GET as getScheduleDetailHandler,
  PATCH as patchScheduleHandler,
  DELETE as deleteScheduleHandler,
} from '../src/app/api/schedules/[id]/route'
import {
  GET as getAssignmentsHandler,
  POST as postAssignmentsHandler,
} from '../src/app/api/schedules/assignments/route'
import {
  GET as getSwapsHandler,
  POST as postSwapsHandler,
} from '../src/app/api/schedules/swaps/route'
import { PATCH as peerResponseHandler } from '../src/app/api/schedules/swaps/[id]/peer-response/route'
import { PATCH as approveSwapHandler } from '../src/app/api/schedules/swaps/[id]/approve/route'
import { DELETE as cancelSwapHandler } from '../src/app/api/schedules/swaps/[id]/route'

describe('Work Shifts & Shift Swap Feature', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ═══════════════════════════════════════════════════
  // 1. ENGINE & CALCULATION TESTS
  // ═══════════════════════════════════════════════════
  describe('Shift Calculation Engine', () => {
    it('tính chính xác thời lượng ca hành chính có trừ nghỉ trưa (08:00 - 17:00, trưa 12:00 - 13:00)', () => {
      const hours = calculateShiftDuration('08:00', '17:00', '12:00', '13:00')
      expect(hours).toBe(8.0)
    })

    it('tính chính xác ca nửa ngày không nghỉ trưa (08:00 - 12:00)', () => {
      const hours = calculateShiftDuration('08:00', '12:00')
      expect(hours).toBe(4.0)
    })

    it('tính chính xác ca đêm qua ngày hôm sau (22:00 - 06:00)', () => {
      const hours = calculateShiftDuration('22:00', '06:00')
      expect(hours).toBe(8.0)
    })

    it('nhận diện đúng ca làm việc qua đêm (isOvernightShift)', () => {
      expect(isOvernightShift('22:00', '06:00')).toBe(true)
      expect(isOvernightShift('08:00', '17:00')).toBe(false)
    })

    it('định dạng nhãn ngày làm việc trong tuần chuẩn tiếng Việt', () => {
      expect(formatWorkDaysLabel([1, 2, 3, 4, 5])).toBe('Thứ 2 - Thứ 6 (Hành chính)')
      expect(formatWorkDaysLabel([1, 2, 3, 4, 5, 6, 7])).toBe('Cả tuần (T2 - CN)')
      expect(formatWorkDaysLabel([1, 3, 5])).toBe('T2, T4, T6')
    })

    it('chặn tự gửi yêu cầu đổi ca cho chính mình', () => {
      const res = validateSwapEligibility('emp_1', 'emp_1', '2026-11-20', '2026-11-21')
      expect(res.isValid).toBe(false)
      expect(res.error).toContain('chính mình')
    })

    it('chặn đổi ca trong quá khứ', () => {
      const res = validateSwapEligibility('emp_1', 'emp_2', '2020-01-01', '2026-11-20')
      expect(res.isValid).toBe(false)
      expect(res.error).toContain('quá khứ')
    })
  })

  // ═══════════════════════════════════════════════════
  // 2. VALIDATION SCHEMA TESTS
  // ═══════════════════════════════════════════════════
  describe('Shift Validation Schemas', () => {
    it('từ chối ca làm việc có định dạng giờ sai (VD: 25:00 hoặc text)', () => {
      const res = scheduleCreateSchema.safeParse({
        branchId: 'b1',
        name: 'Ca Sai',
        startTime: '25:00',
        endTime: '17:00',
      })
      expect(res.success).toBe(false)
    })

    it('từ chối đơn đổi ca có lý do quá ngắn (< 5 ký tự)', () => {
      const res = shiftSwapCreateSchema.safeParse({
        targetEmployeeId: 'emp_2',
        requesterDate: '2026-11-20',
        requesterScheduleId: 'sch_1',
        targetDate: '2026-11-21',
        targetScheduleId: 'sch_2',
        reason: 'bận',
      })
      expect(res.success).toBe(false)
    })
  })

  // ═══════════════════════════════════════════════════
  // 3. SCHEDULE TEMPLATE API TESTS
  // ═══════════════════════════════════════════════════
  describe('Work Schedule Templates API', () => {
    it('GET /api/schedules trả về danh sách ca làm việc', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'u1', role: UserRole.SUPER_ADMIN },
      })
      mockPrisma.workSchedule.findMany.mockResolvedValueOnce([
        { id: 's1', name: 'Ca Sáng', startTime: '06:00', endTime: '14:00' },
      ])

      const req = new NextRequest('http://localhost/api/schedules')
      const res = await getSchedulesHandler(req)
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.data).toHaveLength(1)
      expect(body.data[0].name).toBe('Ca Sáng')
    })

    it('POST /api/schedules chặn EMPLOYEE tạo ca làm việc', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'u2', role: UserRole.EMPLOYEE },
      })

      const req = new NextRequest('http://localhost/api/schedules', {
        method: 'POST',
        body: JSON.stringify({ name: 'Ca Test' }),
      })
      const res = await postSchedulesHandler(req)
      expect(res.status).toBe(403)
    })

    it('POST /api/schedules tạo ca làm việc thành công và hủy ca mặc định cũ nếu chọn isDefault', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'u1', role: UserRole.SUPER_ADMIN },
      })

      mockPrisma.branch.findUnique.mockResolvedValueOnce({ id: 'b1', name: 'Chi nhánh 1' })
      mockPrisma.workSchedule.updateMany.mockResolvedValueOnce({ count: 1 })
      mockPrisma.workSchedule.create.mockResolvedValueOnce({
        id: 's_new',
        name: 'Ca Mặc Định Mới',
        startTime: '08:00',
        endTime: '17:00',
        isDefault: true,
      })

      const req = new NextRequest('http://localhost/api/schedules', {
        method: 'POST',
        body: JSON.stringify({
          branchId: 'b1',
          name: 'Ca Mặc Định Mới',
          startTime: '08:00',
          endTime: '17:00',
          workDays: [1, 2, 3, 4, 5],
          isDefault: true,
        }),
      })

      const res = await postSchedulesHandler(req)
      const body = await res.json()

      expect(res.status).toBe(201)
      expect(body.data.id).toBe('s_new')
      expect(mockPrisma.workSchedule.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { branchId: 'b1', isDefault: true } })
      )
    })

    it('DELETE /api/schedules/[id] chặn xóa nếu đang có phân ca liên kết', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'u1', role: UserRole.SUPER_ADMIN },
      })

      mockPrisma.workSchedule.findUnique.mockResolvedValueOnce({
        id: 's1',
        name: 'Ca Đang Dùng',
        _count: { assignments: 5 },
      })

      const req = new NextRequest('http://localhost/api/schedules/s1', { method: 'DELETE' })
      const res = await deleteScheduleHandler(req, {
        params: Promise.resolve({ id: 's1' }),
      })
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.message).toContain('5 lượt phân ca')
      expect(mockPrisma.workSchedule.delete).not.toHaveBeenCalled()
    })
  })

  // ═══════════════════════════════════════════════════
  // 4. SHIFT ASSIGNMENT API TESTS
  // ═══════════════════════════════════════════════════
  describe('Shift Assignment API', () => {
    it('POST /api/schedules/assignments phân ca hàng loạt cho nhân viên trong transaction', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'u1', role: UserRole.SUPER_ADMIN },
      })

      mockPrisma.workSchedule.findUnique.mockResolvedValueOnce({
        id: 'sch_1',
        name: 'Ca Sáng',
        branchId: 'b1',
      })

      const req = new NextRequest('http://localhost/api/schedules/assignments', {
        method: 'POST',
        body: JSON.stringify({
          employeeIds: ['emp_1', 'emp_2'],
          scheduleId: 'sch_1',
          dates: ['2026-11-20', '2026-11-21'],
          note: 'Phân ca dự án',
        }),
      })

      const res = await postAssignmentsHandler(req)
      const body = await res.json()

      expect(res.status).toBe(201)
      expect(body.data.totalAssigned).toBe(4) // 2 nhân viên * 2 ngày
      expect(mockPrisma.$transaction).toHaveBeenCalled()
    })
  })

  // ═══════════════════════════════════════════════════
  // 5. SHIFT SWAP WORKFLOW API TESTS
  // ═══════════════════════════════════════════════════
  describe('Shift Swap Request Workflow', () => {
    it('POST /api/schedules/swaps nộp yêu cầu đổi ca và gửi thông báo cho đồng nghiệp', async () => {
      mockSession.mockResolvedValueOnce({
        user: {
          id: 'u_emp1',
          role: UserRole.EMPLOYEE,
          employee: { id: 'emp_1', fullName: 'Nguyễn Văn A' },
        },
      })

      mockPrisma.employee.findUnique.mockResolvedValueOnce({
        id: 'emp_2',
        fullName: 'Trần Thị B',
        branchId: 'b1',
      })

      mockPrisma.workSchedule.findUnique
        .mockResolvedValueOnce({ id: 'sch_1', name: 'Ca Sáng' })
        .mockResolvedValueOnce({ id: 'sch_2', name: 'Ca Chiều' })

      mockPrisma.shiftSwapRequest.create.mockResolvedValueOnce({
        id: 'swap_1',
        requesterId: 'emp_1',
        targetEmployeeId: 'emp_2',
        requesterDate: new Date('2026-11-25'),
        targetDate: new Date('2026-11-26'),
        status: ShiftSwapStatus.PENDING_PEER,
        requester: { fullName: 'Nguyễn Văn A' },
        targetEmployee: { fullName: 'Trần Thị B' },
        requesterSchedule: { name: 'Ca Sáng' },
        targetSchedule: { name: 'Ca Chiều' },
      })

      const req = new NextRequest('http://localhost/api/schedules/swaps', {
        method: 'POST',
        body: JSON.stringify({
          targetEmployeeId: 'emp_2',
          requesterDate: '2026-11-25',
          requesterScheduleId: 'sch_1',
          targetDate: '2026-11-26',
          targetScheduleId: 'sch_2',
          reason: 'Bận việc cá nhân cần đổi ca',
        }),
      })

      const res = await postSwapsHandler(req)
      const body = await res.json()

      expect(res.status).toBe(201)
      expect(body.data.id).toBe('swap_1')
      expect(mockPrisma.notification.create).toHaveBeenCalled()
    })

    it('PATCH /api/schedules/swaps/[id]/peer-response đồng nghiệp đồng ý chuyển trạng thái sang PENDING_MANAGER', async () => {
      mockSession.mockResolvedValueOnce({
        user: {
          id: 'u_emp2',
          role: UserRole.EMPLOYEE,
          employee: { id: 'emp_2' },
        },
      })

      mockPrisma.shiftSwapRequest.findUnique.mockResolvedValueOnce({
        id: 'swap_1',
        targetEmployeeId: 'emp_2',
        requesterId: 'emp_1',
        status: ShiftSwapStatus.PENDING_PEER,
        targetEmployee: { fullName: 'Trần Thị B', branchId: 'b1' },
      })

      mockPrisma.shiftSwapRequest.update.mockResolvedValueOnce({
        id: 'swap_1',
        peerStatus: SwapPeerStatus.ACCEPTED,
        status: ShiftSwapStatus.PENDING_MANAGER,
      })

      const req = new NextRequest('http://localhost/api/schedules/swaps/swap_1/peer-response', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'ACCEPT' }),
      })

      const res = await peerResponseHandler(req, {
        params: Promise.resolve({ id: 'swap_1' }),
      })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.data.status).toBe(ShiftSwapStatus.PENDING_MANAGER)
      expect(mockPrisma.notification.create).toHaveBeenCalled()
    })

    it('PATCH /api/schedules/swaps/[id]/approve quản lý phê duyệt tự động hoán đổi phân ca và ghi AuditLog', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'u_manager', role: UserRole.SUPER_ADMIN },
      })

      mockPrisma.shiftSwapRequest.findUnique
        .mockResolvedValueOnce({
          id: 'swap_1',
          requesterId: 'emp_1',
          targetEmployeeId: 'emp_2',
          requesterDate: new Date('2026-11-25'),
          targetDate: new Date('2026-11-26'),
          requesterScheduleId: 'sch_1',
          targetScheduleId: 'sch_2',
          status: ShiftSwapStatus.PENDING_MANAGER,
          requester: { id: 'emp_1', fullName: 'Nguyễn Văn A', branchId: 'b1' },
          targetEmployee: { id: 'emp_2', fullName: 'Trần Thị B', branchId: 'b1' },
        })
        .mockResolvedValueOnce({
          id: 'swap_1',
          status: ShiftSwapStatus.APPROVED,
        })

      const req = new NextRequest('http://localhost/api/schedules/swaps/swap_1/approve', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'APPROVE' }),
      })

      const res = await approveSwapHandler(req, {
        params: Promise.resolve({ id: 'swap_1' }),
      })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(mockPrisma.$transaction).toHaveBeenCalled()
      expect(mockPrisma.shiftAssignment.upsert).toHaveBeenCalledTimes(2)
      expect(mockPrisma.auditLog.create).toHaveBeenCalled()
      expect(mockPrisma.notification.create).toHaveBeenCalledTimes(2) // cả 2 nhân viên
    })

    it('DELETE /api/schedules/swaps/[id] nhân viên hủy đơn đổi ca đang chờ', async () => {
      mockSession.mockResolvedValueOnce({
        user: {
          id: 'u_emp1',
          role: UserRole.EMPLOYEE,
          employee: { id: 'emp_1' },
        },
      })

      mockPrisma.shiftSwapRequest.findUnique.mockResolvedValueOnce({
        id: 'swap_1',
        requesterId: 'emp_1',
        status: ShiftSwapStatus.PENDING_PEER,
      })

      mockPrisma.shiftSwapRequest.update.mockResolvedValueOnce({
        id: 'swap_1',
        status: ShiftSwapStatus.CANCELLED,
      })

      const req = new NextRequest('http://localhost/api/schedules/swaps/swap_1', {
        method: 'DELETE',
      })

      const res = await cancelSwapHandler(req, {
        params: Promise.resolve({ id: 'swap_1' }),
      })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.data.status).toBe(ShiftSwapStatus.CANCELLED)
    })

    it('DELETE /api/schedules/swaps/[id] từ chối hủy nếu đơn đã được phê duyệt (APPROVED)', async () => {
      mockSession.mockResolvedValueOnce({
        user: {
          id: 'u_emp1',
          role: UserRole.EMPLOYEE,
          employee: { id: 'emp_1' },
        },
      })

      mockPrisma.shiftSwapRequest.findUnique.mockResolvedValueOnce({
        id: 'swap_1',
        requesterId: 'emp_1',
        status: ShiftSwapStatus.APPROVED,
      })

      const req = new NextRequest('http://localhost/api/schedules/swaps/swap_1', {
        method: 'DELETE',
      })

      const res = await cancelSwapHandler(req, {
        params: Promise.resolve({ id: 'swap_1' }),
      })
      expect(res.status).toBe(400)
    })

    it('PATCH /api/schedules/swaps/[id]/approve chặn EMPLOYEE phê duyệt đơn đổi ca', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'u_emp', role: UserRole.EMPLOYEE },
      })

      const req = new NextRequest('http://localhost/api/schedules/swaps/swap_1/approve', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'APPROVE' }),
      })

      const res = await approveSwapHandler(req, {
        params: Promise.resolve({ id: 'swap_1' }),
      })
      expect(res.status).toBe(403)
    })
  })
})
