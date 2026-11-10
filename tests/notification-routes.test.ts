import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockSession, mockPrisma } = vi.hoisted(() => {
  const prismaMock: any = {
    employee: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    notification: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
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

import { GET as getNotificationsHandler, PATCH as patchNotificationsHandler } from '../src/app/api/notifications/route'
import {
  createNotification,
  createNotificationsForRoles,
  notifyLeaveSubmitted,
  notifyLeaveDecision,
  notifyOvertimeSubmitted,
  notifyOvertimeDecision,
  notifyCheckInSuccess,
} from '../src/lib/notifications'
import { UserRole } from '@prisma/client'

describe('In-App Notification API & Helpers', () => {
  const mockEmpSession = {
    user: {
      id: 'usr_emp_1',
      email: 'employee@demo.com',
      role: 'EMPLOYEE',
      employee: {
        id: 'emp_1',
        fullName: 'Nguyễn Văn A',
        employeeCode: 'NV001',
        branchId: 'br_hn',
      },
    },
  }

  const sampleNotifications = [
    {
      id: 'notif_1',
      employeeId: 'emp_1',
      type: 'LEAVE_APPROVED',
      title: 'Đơn nghỉ phép đã được phê duyệt',
      message: 'Đơn xin nghỉ phép đã được phê duyệt',
      isRead: false,
      link: '/leaves',
      createdAt: new Date('2026-11-10T08:00:00Z'),
    },
    {
      id: 'notif_2',
      employeeId: 'emp_1',
      type: 'ATTENDANCE_CHECKIN',
      title: 'Chấm công vào thành công',
      message: 'Bạn đã check-in lúc 08:05',
      isRead: true,
      link: '/attendance',
      createdAt: new Date('2026-11-10T01:05:00Z'),
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/notifications', () => {
    it('trả về 401 nếu chưa đăng nhập', async () => {
      mockSession.mockResolvedValue(null)

      const req = new NextRequest('http://localhost:3000/api/notifications')
      const res = await getNotificationsHandler(req)
      const json = await res.json()

      expect(res.status).toBe(401)
      expect(json.success).toBe(false)
    })

    it('trả về danh sách rỗng nếu tài khoản không có hồ sơ nhân viên', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr_no_emp', role: 'SUPER_ADMIN', employee: null },
      })

      const req = new NextRequest('http://localhost:3000/api/notifications')
      const res = await getNotificationsHandler(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data.notifications).toEqual([])
      expect(json.data.unreadCount).toBe(0)
    })

    it('lấy danh sách thông báo và số lượng chưa đọc thành công', async () => {
      mockSession.mockResolvedValue(mockEmpSession)
      mockPrisma.notification.count.mockImplementation((args: any) => {
        if (args?.where?.isRead === false) return Promise.resolve(1)
        return Promise.resolve(2)
      })
      mockPrisma.notification.findMany.mockResolvedValue(sampleNotifications)

      const req = new NextRequest('http://localhost:3000/api/notifications?page=1&limit=10')
      const res = await getNotificationsHandler(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data.notifications).toHaveLength(2)
      expect(json.data.unreadCount).toBe(1)
      expect(json.data.pagination.total).toBe(2)
      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ employeeId: 'emp_1' }),
          take: 10,
          skip: 0,
        })
      )
    })

    it('hỗ trợ lọc chỉ thông báo chưa đọc với unreadOnly=true', async () => {
      mockSession.mockResolvedValue(mockEmpSession)
      mockPrisma.notification.count.mockResolvedValue(1)
      mockPrisma.notification.findMany.mockResolvedValue([sampleNotifications[0]])

      const req = new NextRequest('http://localhost:3000/api/notifications?unreadOnly=true')
      const res = await getNotificationsHandler(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            employeeId: 'emp_1',
            isRead: false,
          }),
        })
      )
    })

    it('xử lý an toàn khi page hoặc limit không hợp lệ (NaN, âm) và fallback về mặc định', async () => {
      mockSession.mockResolvedValue(mockEmpSession)
      mockPrisma.notification.count.mockResolvedValue(0)
      mockPrisma.notification.findMany.mockResolvedValue([])

      const req = new NextRequest('http://localhost:3000/api/notifications?page=abc&limit=invalid')
      const res = await getNotificationsHandler(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
        })
      )
    })

    it('fallback tìm employee qua userId nếu session.user.employee là null', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr_db_emp', role: 'EMPLOYEE', employee: null },
      })
      mockPrisma.employee.findUnique.mockResolvedValue({ id: 'emp_found_in_db' })
      mockPrisma.notification.count.mockResolvedValue(0)
      mockPrisma.notification.findMany.mockResolvedValue([])

      const req = new NextRequest('http://localhost:3000/api/notifications')
      const res = await getNotificationsHandler(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(mockPrisma.employee.findUnique).toHaveBeenCalledWith({
        where: { userId: 'usr_db_emp' },
        select: { id: true },
      })
      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ employeeId: 'emp_found_in_db' }),
        })
      )
    })
  })

  describe('PATCH /api/notifications', () => {
    it('trả về 401 nếu chưa đăng nhập', async () => {
      mockSession.mockResolvedValue(null)

      const req = new NextRequest('http://localhost:3000/api/notifications', {
        method: 'PATCH',
        body: JSON.stringify({ id: 'notif_1' }),
      })
      const res = await patchNotificationsHandler(req)
      const json = await res.json()

      expect(res.status).toBe(401)
      expect(json.success).toBe(false)
    })

    it('trả về 422 nếu body không có id hoặc markAllAsRead', async () => {
      mockSession.mockResolvedValue(mockEmpSession)

      const req = new NextRequest('http://localhost:3000/api/notifications', {
        method: 'PATCH',
        body: JSON.stringify({}),
      })
      const res = await patchNotificationsHandler(req)
      const json = await res.json()

      expect(res.status).toBe(422)
      expect(json.success).toBe(false)
    })

    it('đánh dấu tất cả thông báo là đã đọc khi markAllAsRead=true', async () => {
      mockSession.mockResolvedValue(mockEmpSession)
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 5 })

      const req = new NextRequest('http://localhost:3000/api/notifications', {
        method: 'PATCH',
        body: JSON.stringify({ markAllAsRead: true }),
      })
      const res = await patchNotificationsHandler(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data.unreadCount).toBe(0)
      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { employeeId: 'emp_1', isRead: false },
        data: { isRead: true },
      })
    })

    it('trả về 404 nếu thông báo không tồn tại hoặc không thuộc về nhân viên hiện tại', async () => {
      mockSession.mockResolvedValue(mockEmpSession)
      mockPrisma.notification.findFirst.mockResolvedValue(null)

      const req = new NextRequest('http://localhost:3000/api/notifications', {
        method: 'PATCH',
        body: JSON.stringify({ id: 'non_existent_notif' }),
      })
      const res = await patchNotificationsHandler(req)
      const json = await res.json()

      expect(res.status).toBe(404)
      expect(json.success).toBe(false)
    })

    it('đánh dấu 1 thông báo cụ thể là đã đọc thành công', async () => {
      mockSession.mockResolvedValue(mockEmpSession)
      mockPrisma.notification.findFirst.mockResolvedValue(sampleNotifications[0])
      mockPrisma.notification.update.mockResolvedValue({
        ...sampleNotifications[0],
        isRead: true,
      })
      mockPrisma.notification.count.mockResolvedValue(0)

      const req = new NextRequest('http://localhost:3000/api/notifications', {
        method: 'PATCH',
        body: JSON.stringify({ id: 'notif_1' }),
      })
      const res = await patchNotificationsHandler(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data.unreadCount).toBe(0)
      expect(json.data.notification.isRead).toBe(true)
      expect(mockPrisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif_1' },
        data: { isRead: true },
      })
    })
  })

  describe('Notification Helper Functions (src/lib/notifications.ts)', () => {
    it('createNotification tạo thông báo an toàn', async () => {
      mockPrisma.notification.create.mockResolvedValue({
        id: 'new_n_1',
        employeeId: 'emp_1',
        title: 'Test',
      })

      const result = await createNotification({
        employeeId: 'emp_1',
        type: 'CUSTOM_TYPE',
        title: 'Tiêu đề thông báo',
        message: 'Nội dung thông báo',
        link: '/custom',
      })

      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: {
          employeeId: 'emp_1',
          type: 'CUSTOM_TYPE',
          title: 'Tiêu đề thông báo',
          message: 'Nội dung thông báo',
          link: '/custom',
        },
      })
      expect(result).toHaveProperty('id', 'new_n_1')
    })

    it('createNotificationsForRoles tìm đúng nhân viên quản trị và tạo thông báo batch', async () => {
      mockPrisma.employee.findMany.mockResolvedValue([
        { id: 'emp_mgr_1' },
        { id: 'emp_hr_1' },
      ])
      mockPrisma.notification.createMany.mockResolvedValue({ count: 2 })

      const result = await createNotificationsForRoles({
        roles: [UserRole.BRANCH_ADMIN, UserRole.HR_MANAGER],
        branchId: 'br_hn',
        excludeEmployeeId: 'emp_submitter',
        type: 'LEAVE_SUBMITTED',
        title: 'Đơn mới',
        message: 'Có đơn mới cần duyệt',
        link: '/leaves',
      })

      expect(mockPrisma.employee.findMany).toHaveBeenCalled()
      expect(mockPrisma.notification.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({ employeeId: 'emp_mgr_1', type: 'LEAVE_SUBMITTED' }),
          expect.objectContaining({ employeeId: 'emp_hr_1', type: 'LEAVE_SUBMITTED' }),
        ],
      })
      expect(result).toHaveLength(2)
    })

    it('notifyLeaveSubmitted kích hoạt tạo thông báo cho cấp quản lý', async () => {
      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'emp_mgr_1' }])
      mockPrisma.notification.createMany.mockResolvedValue({ count: 1 })

      await notifyLeaveSubmitted({
        employeeId: 'emp_1',
        employeeName: 'Trần Văn Nam',
        branchId: 'br_hn',
        leaveId: 'leave_123',
        startDate: '2026-11-15',
        endDate: '2026-11-17',
        totalDays: 3,
        leaveTypeName: 'Nghỉ phép năm',
      })

      expect(mockPrisma.employee.findMany).toHaveBeenCalled()
    })

    it('notifyLeaveDecision tạo thông báo kết quả duyệt/từ chối cho nhân viên', async () => {
      mockPrisma.notification.create.mockResolvedValue({ id: 'dec_1' })

      await notifyLeaveDecision({
        employeeId: 'emp_1',
        action: 'APPROVED',
        startDate: '2026-11-15',
        endDate: '2026-11-17',
      })

      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            employeeId: 'emp_1',
            type: 'LEAVE_APPROVED',
            title: expect.stringContaining('phê duyệt'),
          }),
        })
      )
    })

    it('notifyOvertimeSubmitted gửi thông báo yêu cầu OT đến quản lý', async () => {
      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'emp_mgr_1' }])
      mockPrisma.notification.createMany.mockResolvedValue({ count: 1 })

      await notifyOvertimeSubmitted({
        employeeId: 'emp_1',
        employeeName: 'Trần Văn Nam',
        branchId: 'br_hn',
        otId: 'ot_123',
        date: '2026-11-12',
        hours: 2.5,
      })

      expect(mockPrisma.employee.findMany).toHaveBeenCalled()
    })

    it('notifyOvertimeDecision gửi thông báo kết quả OT đến nhân viên', async () => {
      mockPrisma.notification.create.mockResolvedValue({ id: 'ot_dec_1' })

      await notifyOvertimeDecision({
        employeeId: 'emp_1',
        action: 'REJECTED',
        date: '2026-11-12',
        hours: 2,
        rejectReason: 'Không đủ việc cần OT',
      })

      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            employeeId: 'emp_1',
            type: 'OT_REJECTED',
            message: expect.stringContaining('Không đủ việc cần OT'),
          }),
        })
      )
    })

    it('notifyCheckInSuccess tạo thông báo khi nhân viên chấm công thành công', async () => {
      mockPrisma.notification.create.mockResolvedValue({ id: 'chk_1' })

      await notifyCheckInSuccess({
        employeeId: 'emp_1',
        checkInTime: new Date('2026-11-10T08:20:00Z'),
        isLate: true,
        lateMinutes: 20,
      })

      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            employeeId: 'emp_1',
            type: 'ATTENDANCE_CHECKIN',
            title: expect.stringContaining('Đi muộn'),
            message: expect.stringContaining('20 phút'),
          }),
        })
      )
    })

    it('notifyLeaveDecision và notifyOvertimeDecision hỗ trợ truyền transaction client tx', async () => {
      const mockTx: any = {
        notification: {
          create: vi.fn().mockResolvedValue({ id: 'notif_tx_1' }),
        },
      }

      await notifyLeaveDecision(
        {
          employeeId: 'emp_1',
          action: 'APPROVED',
          startDate: '2026-11-15',
          endDate: '2026-11-17',
        },
        mockTx
      )

      expect(mockTx.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            employeeId: 'emp_1',
            type: 'LEAVE_APPROVED',
            message: expect.stringContaining('15/11/2026'),
          }),
        })
      )

      await notifyOvertimeDecision(
        {
          employeeId: 'emp_1',
          action: 'APPROVED',
          date: '2026-11-12',
          hours: 3,
        },
        mockTx
      )

      expect(mockTx.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            employeeId: 'emp_1',
            type: 'OT_APPROVED',
            message: expect.stringContaining('12/11/2026'),
          }),
        })
      )
    })
  })
})
