import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockSession, mockPrisma } = vi.hoisted(() => {
  const prismaMock: any = {
    overtimeRequest: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
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

import { GET as getOvertimeHandler, POST as postOvertimeHandler } from '../src/app/api/overtime/route'
import { PATCH as approveOvertimeHandler } from '../src/app/api/overtime/[id]/approve/route'
import { DELETE as cancelOvertimeHandler } from '../src/app/api/overtime/[id]/route'

describe('Overtime (OT) API Routes', () => {
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

  describe('GET /api/overtime', () => {
    it('nhân viên chỉ xem được danh sách OT của chính mình', async () => {
      mockPrisma.overtimeRequest.count.mockResolvedValue(1)
      mockPrisma.overtimeRequest.findMany.mockResolvedValue([
        { id: 'ot_1', employeeId: 'emp_1', hours: 2, status: 'PENDING' },
      ])

      const req = new NextRequest('http://localhost:3000/api/overtime')
      const res = await getOvertimeHandler(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(mockPrisma.overtimeRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ employeeId: 'emp_1' }),
        })
      )
    })
  })

  describe('POST /api/overtime', () => {
    it('trả về 422 nếu dữ liệu không hợp lệ (số giờ <= 0)', async () => {
      const req = new NextRequest('http://localhost:3000/api/overtime', {
        method: 'POST',
        body: JSON.stringify({
          date: '2024-05-15',
          startTime: '17:30',
          endTime: '19:30',
          hours: -1, // Không hợp lệ
        }),
      })

      const res = await postOvertimeHandler(req)
      const json = await res.json()

      expect(res.status).toBe(422)
      expect(json.success).toBe(false)
    })

    it('trả về 422 nếu giờ kết thúc nhỏ hơn hoặc bằng giờ bắt đầu', async () => {
      const req = new NextRequest('http://localhost:3000/api/overtime', {
        method: 'POST',
        body: JSON.stringify({
          date: '2024-05-15',
          startTime: '20:00',
          endTime: '18:00', // Không hợp lệ: kết thúc trước bắt đầu
          hours: 2,
        }),
      })

      const res = await postOvertimeHandler(req)
      const json = await res.json()

      expect(res.status).toBe(422)
      expect(json.success).toBe(false)
      expect(json.message).toContain('Giờ kết thúc phải sau giờ bắt đầu')
    })

    it('tạo yêu cầu làm thêm giờ thành công với status PENDING', async () => {
      mockPrisma.overtimeRequest.create.mockResolvedValue({
        id: 'new_ot_1',
        employeeId: 'emp_1',
        date: new Date('2024-05-15T00:00:00.000Z'),
        startTime: '17:30',
        endTime: '19:30',
        hours: 2,
        status: 'PENDING',
      })

      const req = new NextRequest('http://localhost:3000/api/overtime', {
        method: 'POST',
        body: JSON.stringify({
          date: '2024-05-15',
          startTime: '17:30',
          endTime: '19:30',
          hours: 2,
          reason: 'Dự án gấp',
        }),
      })

      const res = await postOvertimeHandler(req)
      const json = await res.json()

      expect(res.status).toBe(201)
      expect(json.success).toBe(true)
      expect(json.data.status).toBe('PENDING')
    })
  })

  describe('PATCH /api/overtime/[id]/approve', () => {
    it('Super Admin phê duyệt yêu cầu OT thành công', async () => {
      mockSession.mockResolvedValue({
        user: {
          id: 'admin_1',
          role: 'SUPER_ADMIN',
        },
      })

      mockPrisma.overtimeRequest.findUnique.mockResolvedValue({
        id: 'ot_req_1',
        employeeId: 'emp_1',
        date: new Date('2024-05-15T00:00:00.000Z'),
        hours: 2,
        status: 'PENDING',
        employee: { branchId: 'br_hn' },
      })

      mockPrisma.overtimeRequest.update.mockResolvedValue({
        id: 'ot_req_1',
        status: 'APPROVED',
      })

      const req = new NextRequest('http://localhost:3000/api/overtime/ot_req_1/approve', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'APPROVED' }),
      })

      const res = await approveOvertimeHandler(req, {
        params: Promise.resolve({ id: 'ot_req_1' }),
      })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(mockPrisma.notification.create).toHaveBeenCalled()
    })
  })

  describe('DELETE /api/overtime/[id]', () => {
    it('cho phép nhân viên hủy yêu cầu OT đang PENDING', async () => {
      mockPrisma.overtimeRequest.findUnique.mockResolvedValue({
        id: 'my_pending_ot',
        employeeId: 'emp_1',
        status: 'PENDING',
      })
      mockPrisma.overtimeRequest.update.mockResolvedValue({
        id: 'my_pending_ot',
        status: 'CANCELLED',
      })

      const req = new NextRequest('http://localhost:3000/api/overtime/my_pending_ot')
      const res = await cancelOvertimeHandler(req, {
        params: Promise.resolve({ id: 'my_pending_ot' }),
      })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data.status).toBe('CANCELLED')
    })

    it('từ chối hủy yêu cầu OT của nhân viên khác kể cả khi là Branch Admin', async () => {
      mockSession.mockResolvedValue({
        user: {
          id: 'admin_hn',
          role: 'BRANCH_ADMIN',
          employee: { id: 'emp_adm', branchId: 'br_hn' },
        },
      })

      mockPrisma.overtimeRequest.findUnique.mockResolvedValue({
        id: 'ot_of_emp_2',
        employeeId: 'emp_2', // Khác emp_adm
        status: 'PENDING',
      })

      const req = new NextRequest('http://localhost:3000/api/overtime/ot_of_emp_2')
      const res = await cancelOvertimeHandler(req, {
        params: Promise.resolve({ id: 'ot_of_emp_2' }),
      })
      const json = await res.json()

      expect(res.status).toBe(403)
      expect(json.success).toBe(false)
      expect(json.message).toContain('chính mình tạo')
    })

    it('từ chối duyệt đơn OT nếu không ở trạng thái PENDING', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'admin_1', role: 'SUPER_ADMIN' },
      })
      mockPrisma.overtimeRequest.findUnique.mockResolvedValue({
        id: 'ot_already_approved',
        status: 'APPROVED',
        employee: { branchId: 'br_hn' },
      })

      const req = new NextRequest('http://localhost:3000/api/overtime/ot_already_approved/approve', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'APPROVED' }),
      })

      const res = await approveOvertimeHandler(req, {
        params: Promise.resolve({ id: 'ot_already_approved' }),
      })
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.success).toBe(false)
      expect(json.message).toContain('đã được xử lý')
    })

    it('Branch Admin không thể duyệt OT cho nhân viên chi nhánh khác', async () => {
      mockSession.mockResolvedValue({
        user: {
          id: 'admin_hn',
          role: 'BRANCH_ADMIN',
          employee: { branchId: 'br_hn' },
        },
      })
      mockPrisma.overtimeRequest.findUnique.mockResolvedValue({
        id: 'ot_hcm',
        status: 'PENDING',
        employee: { branchId: 'br_hcm' },
      })

      const req = new NextRequest('http://localhost:3000/api/overtime/ot_hcm/approve', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'APPROVED' }),
      })

      const res = await approveOvertimeHandler(req, {
        params: Promise.resolve({ id: 'ot_hcm' }),
      })
      const json = await res.json()

      expect(res.status).toBe(403)
      expect(json.success).toBe(false)
    })
  })
})
