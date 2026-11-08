import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Use vi.hoisted for variables referenced in vi.mock
const { mockSession, mockPrisma } = vi.hoisted(() => {
  return {
    mockSession: vi.fn(),
    mockPrisma: {
      employee: {
        findUnique: vi.fn(),
      },
      attendanceRecord: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
      },
      branch: {
        findMany: vi.fn(),
      },
      department: {
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

import { POST as checkInHandler } from '../src/app/api/attendance/check-in/route'
import { POST as checkOutHandler } from '../src/app/api/attendance/check-out/route'
import { GET as todayHandler } from '../src/app/api/attendance/today/route'
import { GET as historyHandler } from '../src/app/api/attendance/history/route'
import { GET as myBranchHandler } from '../src/app/api/branches/my-branch/route'
import { GET as recordsHandler } from '../src/app/api/attendance/records/route'

describe('Attendance API Routes', () => {
  const branchHN = {
    id: 'br_hn',
    name: 'Chi nhánh Hà Nội',
    code: 'HN',
    address: 'Hà Đông, Hà Nội',
    latitude: 21.028511,
    longitude: 105.83416,
    gpsRadius: 100,
    schedules: [
      {
        id: 'sch_1',
        name: 'Ca hành chính',
        startTime: '08:00',
        endTime: '17:00',
        lunchStart: '12:00',
        lunchEnd: '13:00',
        lateThreshold: 15,
        earlyThreshold: 15,
      },
    ],
  }

  const sampleEmployee = {
    id: 'emp_1',
    userId: 'usr_1',
    employeeCode: 'NV001',
    fullName: 'Nguyễn Văn A',
    branchId: branchHN.id,
    branch: branchHN,
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

  describe('POST /api/attendance/check-in', () => {
    it('trả về 401 nếu chưa đăng nhập hoặc không có employee profile', async () => {
      mockSession.mockResolvedValue(null)
      const req = new NextRequest('http://localhost:3000/api/attendance/check-in', {
        method: 'POST',
        body: JSON.stringify({ latitude: 21.0285, longitude: 105.8341 }),
      })
      const res = await checkInHandler(req)
      const json = await res.json()

      expect(res.status).toBe(401)
      expect(json.success).toBe(false)
      expect(json.error).toBe('UNAUTHORIZED')
    })

    it('trả về 422 nếu dữ liệu đầu vào không hợp lệ', async () => {
      const req = new NextRequest('http://localhost:3000/api/attendance/check-in', {
        method: 'POST',
        body: JSON.stringify({ latitude: 'invalid' }),
      })
      const res = await checkInHandler(req)
      const json = await res.json()

      expect(res.status).toBe(422)
      expect(json.success).toBe(false)
      expect(json.error).toBe('VALIDATION_ERROR')
    })

    it('từ chối check-in khi độ chính xác GPS thấp (> 50m)', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(sampleEmployee)

      const req = new NextRequest('http://localhost:3000/api/attendance/check-in', {
        method: 'POST',
        body: JSON.stringify({
          latitude: branchHN.latitude,
          longitude: branchHN.longitude,
          accuracy: 80, // > 50m
        }),
      })
      const res = await checkInHandler(req)
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('GPS_ACCURACY_LOW')
    })

    it('từ chối check-in khi vị trí nằm ngoài bán kính cho phép', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(sampleEmployee)

      // Cách văn phòng hơn 1km
      const req = new NextRequest('http://localhost:3000/api/attendance/check-in', {
        method: 'POST',
        body: JSON.stringify({
          latitude: 21.0485,
          longitude: 105.8541,
          accuracy: 10,
        }),
      })
      const res = await checkInHandler(req)
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('OUTSIDE_GEOFENCE')
      expect(json.details.distance).toBeGreaterThan(100)
    })

    it('từ chối check-in khi hôm nay đã check-in rồi', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(sampleEmployee)
      mockPrisma.attendanceRecord.findUnique.mockResolvedValue({
        id: 'att_exist',
        checkInTime: new Date(),
      })

      const req = new NextRequest('http://localhost:3000/api/attendance/check-in', {
        method: 'POST',
        body: JSON.stringify({
          latitude: branchHN.latitude,
          longitude: branchHN.longitude,
          accuracy: 15,
        }),
      })
      const res = await checkInHandler(req)
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('ALREADY_CHECKED_IN')
    })

    it('check-in thành công khi tọa độ hợp lệ trong geofence', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(sampleEmployee)
      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null)

      const mockRecord = {
        id: 'att_new',
        employeeId: 'emp_1',
        checkInTime: new Date(),
        isLate: false,
        lateMinutes: 0,
      }
      mockPrisma.attendanceRecord.upsert.mockResolvedValue(mockRecord)

      const req = new NextRequest('http://localhost:3000/api/attendance/check-in', {
        method: 'POST',
        body: JSON.stringify({
          latitude: branchHN.latitude + 0.0001,
          longitude: branchHN.longitude + 0.0001,
          accuracy: 15,
          deviceInfo: 'Chrome on MacOS',
        }),
      })
      const res = await checkInHandler(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data.id).toBe('att_new')
      expect(json.data.distanceFromBranch).toBeLessThanOrEqual(100)
      expect(mockPrisma.attendanceRecord.upsert).toHaveBeenCalled()
    })
  })

  describe('POST /api/attendance/check-out', () => {
    it('từ chối check-out khi chưa từng check-in trong ngày', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(sampleEmployee)
      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null)

      const req = new NextRequest('http://localhost:3000/api/attendance/check-out', {
        method: 'POST',
        body: JSON.stringify({
          latitude: branchHN.latitude,
          longitude: branchHN.longitude,
          accuracy: 15,
        }),
      })
      const res = await checkOutHandler(req)
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('NOT_CHECKED_IN')
    })

    it('từ chối check-out khi đã check-out hôm nay rồi', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(sampleEmployee)
      mockPrisma.attendanceRecord.findUnique.mockResolvedValue({
        id: 'att_done',
        checkInTime: new Date('2024-01-15T08:00:00+07:00'),
        checkOutTime: new Date('2024-01-15T17:00:00+07:00'),
      })

      const req = new NextRequest('http://localhost:3000/api/attendance/check-out', {
        method: 'POST',
        body: JSON.stringify({
          latitude: branchHN.latitude,
          longitude: branchHN.longitude,
          accuracy: 15,
        }),
      })
      const res = await checkOutHandler(req)
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('ALREADY_CHECKED_OUT')
    })

    it('từ chối check-out nếu thời gian check-out trước hoặc bằng thời gian check-in', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(sampleEmployee)
      // Check-in trong tương lai (1 tiếng nữa)
      mockPrisma.attendanceRecord.findUnique.mockResolvedValue({
        id: 'att_future',
        checkInTime: new Date(Date.now() + 3600000),
        checkOutTime: null,
      })

      const req = new NextRequest('http://localhost:3000/api/attendance/check-out', {
        method: 'POST',
        body: JSON.stringify({
          latitude: branchHN.latitude,
          longitude: branchHN.longitude,
          accuracy: 15,
        }),
      })
      const res = await checkOutHandler(req)
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('VALIDATION_ERROR')
    })

    it('check-out thành công và cập nhật thời lượng làm việc, số ngày công', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(sampleEmployee)

      const checkInTime = new Date(Date.now() - 8 * 3600000) // 8 giờ trước
      mockPrisma.attendanceRecord.findUnique.mockResolvedValue({
        id: 'att_ongoing',
        checkInTime,
        checkOutTime: null,
        status: 'PRESENT',
      })

      const updatedRecord = {
        id: 'att_ongoing',
        checkOutTime: new Date(),
        workDuration: 7,
        workDays: 1,
        isEarlyLeave: false,
        earlyMinutes: 0,
      }
      mockPrisma.attendanceRecord.update.mockResolvedValue(updatedRecord)

      const req = new NextRequest('http://localhost:3000/api/attendance/check-out', {
        method: 'POST',
        body: JSON.stringify({
          latitude: branchHN.latitude,
          longitude: branchHN.longitude,
          accuracy: 15,
        }),
      })
      const res = await checkOutHandler(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data.workDays).toBe(1)
      expect(mockPrisma.attendanceRecord.update).toHaveBeenCalled()
    })
  })

  describe('GET /api/attendance/today', () => {
    it('trả về NOT_CHECKED_IN khi chưa có bản ghi hôm nay', async () => {
      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null)

      const req = new NextRequest('http://localhost:3000/api/attendance/today')
      const res = await todayHandler(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.data.status).toBe('NOT_CHECKED_IN')
      expect(json.data.checkInTime).toBeNull()
    })

    it('trả về CHECKED_IN khi đã check-in nhưng chưa check-out', async () => {
      mockPrisma.attendanceRecord.findUnique.mockResolvedValue({
        id: 'att_1',
        checkInTime: new Date(),
        checkOutTime: null,
        isLate: false,
        lateMinutes: 0,
      })

      const req = new NextRequest('http://localhost:3000/api/attendance/today')
      const res = await todayHandler(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.data.status).toBe('CHECKED_IN')
      expect(json.data.checkInTime).not.toBeNull()
    })

    it('trả về CHECKED_OUT khi đã hoàn thành cả 2 lần', async () => {
      mockPrisma.attendanceRecord.findUnique.mockResolvedValue({
        id: 'att_1',
        checkInTime: new Date(),
        checkOutTime: new Date(),
        isLate: false,
        lateMinutes: 0,
        workDuration: 8,
        workDays: 1,
      })

      const req = new NextRequest('http://localhost:3000/api/attendance/today')
      const res = await todayHandler(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.data.status).toBe('CHECKED_OUT')
      expect(json.data.workDays).toBe(1)
    })
  })

  describe('GET /api/attendance/history', () => {
    it('trả về danh sách lịch sử cá nhân và metadata phân trang', async () => {
      const records = [
        { id: 'rec_1', date: new Date('2024-01-15'), workDuration: 8, workDays: 1 },
        { id: 'rec_2', date: new Date('2024-01-14'), workDuration: 8, workDays: 1 },
      ]
      mockPrisma.attendanceRecord.count.mockResolvedValue(2)
      mockPrisma.attendanceRecord.findMany.mockResolvedValue(records)

      const req = new NextRequest('http://localhost:3000/api/attendance/history?page=1&limit=10')
      const res = await historyHandler(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.data.records).toHaveLength(2)
      expect(json.data.pagination.total).toBe(2)
      expect(json.data.pagination.totalPages).toBe(1)
    })
    it('trả về 422 nếu tham số from hoặc to không đúng định dạng YYYY-MM-DD', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/attendance/history?from=not-a-date'
      )
      const res = await historyHandler(req)
      const json = await res.json()

      expect(res.status).toBe(422)
      expect(json.error).toBe('VALIDATION_ERROR')
    })
  })

  describe('GET /api/branches/my-branch', () => {
    it('trả về thông tin GPS và ca làm việc của chi nhánh nhân viên', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(sampleEmployee)

      const req = new NextRequest('http://localhost:3000/api/branches/my-branch')
      const res = await myBranchHandler(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.data.id).toBe(branchHN.id)
      expect(json.data.latitude).toBe(branchHN.latitude)
      expect(json.data.gpsRadius).toBe(branchHN.gpsRadius)
      expect(json.data.schedule.startTime).toBe('08:00')
    })
  })

  describe('GET /api/attendance/records (Admin/HR)', () => {
    it('từ chối nhân viên thường (role: EMPLOYEE) truy cập danh sách quản lý', async () => {
      mockSession.mockResolvedValue({
        user: { role: 'EMPLOYEE' },
      })

      const req = new NextRequest('http://localhost:3000/api/attendance/records')
      const res = await recordsHandler(req)
      const json = await res.json()

      expect(res.status).toBe(403)
      expect(json.error).toBe('FORBIDDEN')
    })

    it('từ chối BRANCH_ADMIN nếu tài khoản không có branchId', async () => {
      mockSession.mockResolvedValue({
        user: {
          role: 'BRANCH_ADMIN',
          employee: null,
        },
      })

      const req = new NextRequest('http://localhost:3000/api/attendance/records')
      const res = await recordsHandler(req)
      const json = await res.json()

      expect(res.status).toBe(403)
      expect(json.error).toBe('FORBIDDEN')
    })

    it('trả về 422 nếu tham số date không đúng định dạng YYYY-MM-DD', async () => {
      mockSession.mockResolvedValue({
        user: { role: 'SUPER_ADMIN' },
      })

      const req = new NextRequest('http://localhost:3000/api/attendance/records?date=invalid-date')
      const res = await recordsHandler(req)
      const json = await res.json()

      expect(res.status).toBe(422)
      expect(json.error).toBe('VALIDATION_ERROR')
    })

    it('cho phép SUPER_ADMIN hoặc HR_MANAGER truy cập và lọc bản ghi', async () => {
      mockSession.mockResolvedValue({
        user: { role: 'HR_MANAGER' },
      })
      mockPrisma.attendanceRecord.count.mockResolvedValue(1)
      mockPrisma.attendanceRecord.findMany.mockResolvedValue([
        {
          id: 'rec_admin_1',
          date: new Date('2024-01-15'),
          employee: { fullName: 'Nguyễn Văn A' },
        },
      ])

      const req = new NextRequest(
        'http://localhost:3000/api/attendance/records?date=2024-01-15'
      )
      const res = await recordsHandler(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data.records).toHaveLength(1)
    })
  })
})
