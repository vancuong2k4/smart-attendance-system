import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockSession, mockPrisma } = vi.hoisted(() => {
  const prismaMock: any = {
    employee: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    leaveType: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    leaveRequest: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    attendanceRecord: {
      upsert: vi.fn(),
    },
    notification: {
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

import { GET as getLeaveTypesHandler } from '../src/app/api/leave-types/route'
import { GET as getLeavesHandler, POST as postLeavesHandler } from '../src/app/api/leaves/route'
import { PATCH as approveLeaveHandler } from '../src/app/api/leaves/[id]/approve/route'
import { GET as getLeaveDetailHandler, DELETE as cancelLeaveHandler } from '../src/app/api/leaves/[id]/route'

describe('Leave Management API Routes', () => {
  const mockLeaveTypeAL = {
    id: 'lt_al_1',
    code: 'AL',
    name: 'Nghỉ phép năm',
    isPaid: true,
    requireApproval: true,
  }

  const mockEmployee = {
    id: 'emp_1',
    userId: 'usr_1',
    employeeCode: 'NV001',
    fullName: 'Nguyễn Văn A',
    branchId: 'br_hn',
    annualLeaveBalance: 12,
    sickLeaveBalance: 10,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockSession.mockResolvedValue({
      user: {
        id: 'usr_1',
        email: 'nv001@demo.com',
        role: 'EMPLOYEE',
        employee: {
          id: 'emp_1',
          branchId: 'br_hn',
        },
      },
    })
  })

  describe('GET /api/leave-types', () => {
    it('trả về 401 nếu chưa đăng nhập', async () => {
      mockSession.mockResolvedValue(null)
      const req = new NextRequest('http://localhost:3000/api/leave-types')
      const res = await getLeaveTypesHandler(req)
      const json = await res.json()

      expect(res.status).toBe(401)
      expect(json.success).toBe(false)
    })

    it('trả về danh sách loại nghỉ phép thành công', async () => {
      mockPrisma.leaveType.findMany.mockResolvedValue([mockLeaveTypeAL])
      const req = new NextRequest('http://localhost:3000/api/leave-types')
      const res = await getLeaveTypesHandler(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data).toHaveLength(1)
      expect(json.data[0].code).toBe('AL')
    })
  })

  describe('GET /api/leaves', () => {
    it('nhân viên chỉ xem được đơn của mình', async () => {
      mockPrisma.leaveRequest.count.mockResolvedValue(1)
      mockPrisma.leaveRequest.findMany.mockResolvedValue([
        { id: 'leave_1', employeeId: 'emp_1', status: 'PENDING' },
      ])

      const req = new NextRequest('http://localhost:3000/api/leaves?employeeId=other_emp')
      const res = await getLeavesHandler(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      // verify where clause had employeeId: 'emp_1'
      expect(mockPrisma.leaveRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ employeeId: 'emp_1' }),
        })
      )
    })

    it('Branch Admin chỉ xem được đơn của nhân viên chi nhánh mình', async () => {
      mockSession.mockResolvedValue({
        user: {
          id: 'adm_hn',
          role: 'BRANCH_ADMIN',
          employee: { id: 'emp_adm', branchId: 'br_hn' },
        },
      })
      mockPrisma.leaveRequest.count.mockResolvedValue(2)
      mockPrisma.leaveRequest.findMany.mockResolvedValue([])

      const req = new NextRequest('http://localhost:3000/api/leaves')
      await getLeavesHandler(req)

      expect(mockPrisma.leaveRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            employee: { branchId: 'br_hn' },
          }),
        })
      )
    })
  })

  describe('POST /api/leaves', () => {
    it('trả về 404 nếu loại nghỉ phép không tồn tại', async () => {
      mockPrisma.leaveType.findFirst.mockResolvedValue(null)
      const req = new NextRequest('http://localhost:3000/api/leaves', {
        method: 'POST',
        body: JSON.stringify({
          leaveTypeId: 'invalid_type',
          startDate: '2024-05-10',
          endDate: '2024-05-12',
          totalDays: 3,
        }),
      })

      const res = await postLeavesHandler(req)
      const json = await res.json()

      expect(res.status).toBe(404)
      expect(json.success).toBe(false)
    })

    it('trả về 400 nếu số dư phép năm (AL) không đủ', async () => {
      mockPrisma.leaveType.findFirst.mockResolvedValue(mockLeaveTypeAL)
      mockPrisma.employee.findUnique.mockResolvedValue({
        ...mockEmployee,
        annualLeaveBalance: 2, // Chỉ còn 2 ngày
      })

      const req = new NextRequest('http://localhost:3000/api/leaves', {
        method: 'POST',
        body: JSON.stringify({
          leaveTypeId: 'lt_al_1',
          startDate: '2024-05-10',
          endDate: '2024-05-15',
          totalDays: 5, // Yêu cầu 5 ngày
        }),
      })

      const res = await postLeavesHandler(req)
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.success).toBe(false)
      expect(json.message).toContain('Số dư ngày phép năm không đủ')
    })

    it('trả về 400 nếu khoảng thời gian xin nghỉ trùng lặp với đơn khác', async () => {
      mockPrisma.leaveType.findFirst.mockResolvedValue(mockLeaveTypeAL)
      mockPrisma.employee.findUnique.mockResolvedValue(mockEmployee)
      // Đã có đơn PENDING trùng ngày
      mockPrisma.leaveRequest.findFirst.mockResolvedValue({
        id: 'existing_leave',
        status: 'PENDING',
      })

      const req = new NextRequest('http://localhost:3000/api/leaves', {
        method: 'POST',
        body: JSON.stringify({
          leaveTypeId: 'lt_al_1',
          startDate: '2024-05-10',
          endDate: '2024-05-12',
          totalDays: 3,
        }),
      })

      const res = await postLeavesHandler(req)
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.success).toBe(false)
      expect(json.message).toContain('trùng với một đơn khác')
    })

    it('tạo đơn xin nghỉ thành công với status PENDING', async () => {
      mockPrisma.leaveType.findFirst.mockResolvedValue(mockLeaveTypeAL)
      mockPrisma.employee.findUnique.mockResolvedValue(mockEmployee)
      mockPrisma.leaveRequest.findFirst.mockResolvedValue(null) // Không trùng
      mockPrisma.leaveRequest.create.mockResolvedValue({
        id: 'new_leave_1',
        employeeId: 'emp_1',
        leaveTypeId: 'lt_al_1',
        totalDays: 2,
        status: 'PENDING',
      })

      const req = new NextRequest('http://localhost:3000/api/leaves', {
        method: 'POST',
        body: JSON.stringify({
          leaveTypeId: 'lt_al_1',
          startDate: '2024-05-10',
          endDate: '2024-05-11',
          totalDays: 2,
          reason: 'Việc gia đình',
        }),
      })

      const res = await postLeavesHandler(req)
      const json = await res.json()

      expect(res.status).toBe(201)
      expect(json.success).toBe(true)
      expect(json.data.status).toBe('PENDING')
    })
  })

  describe('PATCH /api/leaves/[id]/approve', () => {
    it('trả về 403 nếu nhân viên cố gắng tự duyệt đơn', async () => {
      const req = new NextRequest('http://localhost:3000/api/leaves/l_1/approve', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'APPROVED' }),
      })

      const res = await approveLeaveHandler(req, {
        params: Promise.resolve({ id: 'l_1' }),
      })
      const json = await res.json()

      expect(res.status).toBe(403)
      expect(json.success).toBe(false)
    })

    it('Branch Admin không được duyệt đơn của nhân viên chi nhánh khác', async () => {
      mockSession.mockResolvedValue({
        user: {
          id: 'adm_hn',
          role: 'BRANCH_ADMIN',
          employee: { id: 'emp_adm', branchId: 'br_hn' },
        },
      })

      mockPrisma.leaveRequest.findUnique.mockResolvedValue({
        id: 'leave_hcm',
        status: 'PENDING',
        employee: { branchId: 'br_hcm', annualLeaveBalance: 10 },
        leaveType: mockLeaveTypeAL,
        totalDays: 2,
      })

      const req = new NextRequest('http://localhost:3000/api/leaves/leave_hcm/approve', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'APPROVED' }),
      })

      const res = await approveLeaveHandler(req, {
        params: Promise.resolve({ id: 'leave_hcm' }),
      })
      const json = await res.json()

      expect(res.status).toBe(403)
      expect(json.message).toContain('thuộc chi nhánh của mình')
    })

    it('phê duyệt đơn AL thành công: tự động trừ số dư phép và ghi nhận chấm công', async () => {
      mockSession.mockResolvedValue({
        user: {
          id: 'hr_1',
          role: 'HR_MANAGER',
          employee: { id: 'emp_hr', branchId: 'br_hn' },
        },
      })

      mockPrisma.leaveRequest.findUnique.mockResolvedValue({
        id: 'leave_valid',
        employeeId: 'emp_1',
        status: 'PENDING',
        startDate: new Date('2024-05-10T00:00:00.000Z'),
        endDate: new Date('2024-05-10T00:00:00.000Z'),
        totalDays: 1,
        employee: {
          id: 'emp_1',
          branchId: 'br_hn',
          annualLeaveBalance: 12,
        },
        leaveType: mockLeaveTypeAL,
      })

      mockPrisma.leaveRequest.update.mockResolvedValue({
        id: 'leave_valid',
        status: 'APPROVED',
      })

      const req = new NextRequest('http://localhost:3000/api/leaves/leave_valid/approve', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'APPROVED' }),
      })

      const res = await approveLeaveHandler(req, {
        params: Promise.resolve({ id: 'leave_valid' }),
      })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)

      // Kiểm tra việc trừ ngày phép
      expect(mockPrisma.employee.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'emp_1' },
          data: { annualLeaveBalance: { decrement: 1 } },
        })
      )

      // Kiểm tra việc cập nhật attendanceRecord
      expect(mockPrisma.attendanceRecord.upsert).toHaveBeenCalled()
      // Kiểm tra việc tạo notification
      expect(mockPrisma.notification.create).toHaveBeenCalled()
    })
  })

  describe('DELETE /api/leaves/[id]', () => {
    it('cho phép nhân viên hủy đơn đang PENDING', async () => {
      mockPrisma.leaveRequest.findUnique.mockResolvedValue({
        id: 'my_pending_leave',
        employeeId: 'emp_1',
        status: 'PENDING',
      })
      mockPrisma.leaveRequest.update.mockResolvedValue({
        id: 'my_pending_leave',
        status: 'CANCELLED',
      })

      const req = new NextRequest('http://localhost:3000/api/leaves/my_pending_leave')
      const res = await cancelLeaveHandler(req, {
        params: Promise.resolve({ id: 'my_pending_leave' }),
      })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data.status).toBe('CANCELLED')
    })

    it('từ chối hủy đơn nếu đơn đã được APPROVED', async () => {
      mockPrisma.leaveRequest.findUnique.mockResolvedValue({
        id: 'my_approved_leave',
        employeeId: 'emp_1',
        status: 'APPROVED',
      })

      const req = new NextRequest('http://localhost:3000/api/leaves/my_approved_leave')
      const res = await cancelLeaveHandler(req, {
        params: Promise.resolve({ id: 'my_approved_leave' }),
      })
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.success).toBe(false)
      expect(json.message).toContain('Chỉ có thể hủy đơn khi đang ở trạng thái chờ duyệt')
    })

    it('từ chối hủy đơn của nhân viên khác', async () => {
      mockPrisma.leaveRequest.findUnique.mockResolvedValue({
        id: 'other_emp_leave',
        employeeId: 'emp_2', // khác emp_1
        status: 'PENDING',
      })

      const req = new NextRequest('http://localhost:3000/api/leaves/other_emp_leave')
      const res = await cancelLeaveHandler(req, {
        params: Promise.resolve({ id: 'other_emp_leave' }),
      })
      const json = await res.json()

      expect(res.status).toBe(403)
      expect(json.success).toBe(false)
    })

    it('Branch Admin không được phép hủy đơn xin nghỉ của nhân viên khác', async () => {
      mockSession.mockResolvedValue({
        user: {
          id: 'admin_hn',
          role: 'BRANCH_ADMIN',
          employee: { id: 'emp_adm', branchId: 'br_hn' },
        },
      })

      mockPrisma.leaveRequest.findUnique.mockResolvedValue({
        id: 'emp_leave_123',
        employeeId: 'emp_staff', // Không phải emp_adm
        status: 'PENDING',
      })

      const req = new NextRequest('http://localhost:3000/api/leaves/emp_leave_123')
      const res = await cancelLeaveHandler(req, {
        params: Promise.resolve({ id: 'emp_leave_123' }),
      })
      const json = await res.json()

      expect(res.status).toBe(403)
      expect(json.success).toBe(false)
      expect(json.message).toContain('chính mình tạo')
    })
  })

  describe('Edge Cases in Leaves', () => {
    it('trả về 422 nếu startDate > endDate', async () => {
      const req = new NextRequest('http://localhost:3000/api/leaves', {
        method: 'POST',
        body: JSON.stringify({
          leaveTypeId: 'lt_al_1',
          startDate: '2024-05-20',
          endDate: '2024-05-10', // Trước ngày bắt đầu
          totalDays: 1,
        }),
      })

      const res = await postLeavesHandler(req)
      const json = await res.json()

      expect(res.status).toBe(422)
      expect(json.success).toBe(false)
    })

    it('trả về 403 nếu tài khoản không có hồ sơ nhân viên', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr_no_emp', role: 'EMPLOYEE', employee: null },
      })

      const req = new NextRequest('http://localhost:3000/api/leaves', {
        method: 'POST',
        body: JSON.stringify({
          leaveTypeId: 'lt_al_1',
          startDate: '2024-05-10',
          endDate: '2024-05-11',
          totalDays: 2,
        }),
      })

      const res = await postLeavesHandler(req)
      const json = await res.json()

      expect(res.status).toBe(403)
      expect(json.success).toBe(false)
    })

    it('từ chối đơn (REJECTED) kèm lý do và không trừ ngày phép', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'hr_1', role: 'HR_MANAGER' },
      })

      mockPrisma.leaveRequest.findUnique.mockResolvedValue({
        id: 'leave_to_reject',
        employeeId: 'emp_1',
        status: 'PENDING',
        startDate: new Date('2024-05-10T00:00:00.000Z'),
        endDate: new Date('2024-05-10T00:00:00.000Z'),
        totalDays: 1,
        employee: { branchId: 'br_hn', annualLeaveBalance: 12 },
        leaveType: mockLeaveTypeAL,
      })

      mockPrisma.leaveRequest.update.mockResolvedValue({
        id: 'leave_to_reject',
        status: 'REJECTED',
        rejectReason: 'Trùng lịch công tác dự án',
      })

      const req = new NextRequest('http://localhost:3000/api/leaves/leave_to_reject/approve', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'REJECTED', rejectReason: 'Trùng lịch công tác dự án' }),
      })

      const res = await approveLeaveHandler(req, {
        params: Promise.resolve({ id: 'leave_to_reject' }),
      })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      // Không gọi update trừ ngày phép
      expect(mockPrisma.employee.update).not.toHaveBeenCalled()
      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'LEAVE_REJECTED',
          }),
        })
      )
    })
  })
})
