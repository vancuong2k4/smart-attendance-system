import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import path from 'path'
import fs from 'fs'

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
import { POST as selfieHandler } from '../src/app/api/attendance/selfie/route'
import { GET as recordsHandler } from '../src/app/api/attendance/records/route'
import { saveAttendancePhoto, ensureUploadDir } from '../src/lib/storage'

describe('Selfie & Attendance Photo Feature', () => {
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

  // Minimal 1x1 base64 transparent PNG
  const sampleBase64Png =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

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

  describe('Storage Utility: saveAttendancePhoto', () => {
    it('trả về trực tiếp URL nếu đã là đường dẫn uploads hoặc URL hợp lệ', async () => {
      const existing = '/uploads/attendance/selfie_emp1_123.jpg'
      const res = await saveAttendancePhoto(existing, 'emp_1')
      expect(res).toBe(existing)

      const externalUrl = 'https://cdn.example.com/photo.jpg'
      expect(await saveAttendancePhoto(externalUrl, 'emp_1')).toBe(externalUrl)
    })

    it('lưu ảnh từ base64 data URI thành file trong public/uploads/attendance', async () => {
      const url = await saveAttendancePhoto(sampleBase64Png, 'emp_1')
      expect(url).toMatch(/^\/uploads\/attendance\/selfie_emp_1_\d+_[a-f0-9]+\.png$/)

      // Kiểm tra file có thực sự được tạo trong filesystem
      const fullPath = path.join(process.cwd(), 'public', url.replace(/^\//, ''))
      expect(fs.existsSync(fullPath)).toBe(true)

      // Dọn dẹp file test
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath)
      }
    })

    it('ném lỗi nếu dung lượng ảnh vượt quá 10MB', async () => {
      const hugeBuffer = Buffer.alloc(11 * 1024 * 1024)
      await expect(saveAttendancePhoto(hugeBuffer, 'emp_1')).rejects.toThrow(
        'Dung lượng ảnh vượt quá giới hạn'
      )
    })

    it('từ chối ảnh định dạng SVG để phòng ngừa Stored XSS', async () => {
      const svgDataUri = 'data:image/svg+xml;base64,PHN2Zz48c2NyaXB0PmFsZXJ0KDEpPC9zY3JpcHQ+PC9zdmc+'
      await expect(saveAttendancePhoto(svgDataUri, 'emp_1')).rejects.toThrow(
        'Định dạng ảnh không được hỗ trợ'
      )
    })

    it('từ chối đường dẫn uploads chứa path traversal (..)', async () => {
      const malicious = '/uploads/attendance/../../etc/passwd'
      await expect(saveAttendancePhoto(malicious, 'emp_1')).rejects.toThrow(
        'không hợp lệ hoặc có dấu hiệu bất thường'
      )
    })

    it('từ chối dữ liệu ảnh rỗng hoặc chỉ có khoảng trắng', async () => {
      await expect(saveAttendancePhoto('   ', 'emp_1')).rejects.toThrow(
        'Dữ liệu ảnh không hợp lệ hoặc rỗng'
      )
    })
  })

  describe('POST /api/attendance/selfie', () => {
    it('trả về 401 nếu chưa đăng nhập', async () => {
      mockSession.mockResolvedValue(null)
      const req = new NextRequest('http://localhost:3000/api/attendance/selfie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo: sampleBase64Png }),
      })
      const res = await selfieHandler(req)
      expect(res.status).toBe(401)
    })

    it('trả về 422 nếu thiếu trường ảnh trong JSON payload', async () => {
      const req = new NextRequest('http://localhost:3000/api/attendance/selfie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const res = await selfieHandler(req)
      const json = await res.json()
      expect(res.status).toBe(422)
      expect(json.success).toBe(false)
    })

    it('upload ảnh selfie thành công qua JSON base64', async () => {
      const req = new NextRequest('http://localhost:3000/api/attendance/selfie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo: sampleBase64Png }),
      })
      const res = await selfieHandler(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data.url).toMatch(/^\/uploads\/attendance\//)

      // Cleanup
      const fullPath = path.join(process.cwd(), 'public', json.data.url.replace(/^\//, ''))
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath)
    })

    it('upload ảnh selfie thành công qua FormData multipart', async () => {
      const formData = new FormData()
      const blob = new Blob([Buffer.from('fake-image-bytes')], { type: 'image/jpeg' })
      formData.append('photo', blob, 'selfie.jpg')

      const req = new NextRequest('http://localhost:3000/api/attendance/selfie', {
        method: 'POST',
        body: formData,
      })
      const res = await selfieHandler(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data.url).toMatch(/^\/uploads\/attendance\//)

      // Cleanup
      const fullPath = path.join(process.cwd(), 'public', json.data.url.replace(/^\//, ''))
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath)
    })
  })

  describe('Check-in với ảnh Selfie', () => {
    it('lưu ảnh checkInPhoto khi check-in thành công', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(sampleEmployee)
      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null)

      const savedUrl = '/uploads/attendance/selfie_emp1_test.jpg'
      mockPrisma.attendanceRecord.upsert.mockImplementation(({ create }) => {
        return Promise.resolve({
          id: 'att_photo_1',
          employeeId: sampleEmployee.id,
          date: new Date(),
          checkInTime: new Date(),
          checkInPhoto: create.checkInPhoto,
          isLate: false,
          lateMinutes: 0,
        })
      })

      const req = new NextRequest('http://localhost:3000/api/attendance/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: branchHN.latitude + 0.0001,
          longitude: branchHN.longitude + 0.0001,
          accuracy: 10,
          photo: sampleBase64Png,
        }),
      })

      const res = await checkInHandler(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data.checkInPhoto).toMatch(/^\/uploads\/attendance\//)
      expect(mockPrisma.attendanceRecord.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            checkInPhoto: expect.stringMatching(/^\/uploads\/attendance\//),
          }),
        })
      )

      // Cleanup
      const fullPath = path.join(process.cwd(), 'public', json.data.checkInPhoto.replace(/^\//, ''))
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath)
    })

    it('trả về 422 nếu ảnh check-in vượt quá giới hạn 10MB', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(sampleEmployee)
      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null)

      // 15MB base64 string -> ~11.25MB decoded binary bytes (> 10MB limit)
      const hugeBase64 = 'data:image/jpeg;base64,' + 'A'.repeat(15 * 1024 * 1024)

      const req = new NextRequest('http://localhost:3000/api/attendance/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: branchHN.latitude,
          longitude: branchHN.longitude,
          accuracy: 10,
          photo: hugeBase64,
        }),
      })

      const res = await checkInHandler(req)
      const json = await res.json()

      expect(res.status).toBe(422)
      expect(json.success).toBe(false)
      expect(json.message).toContain('giới hạn')
      expect(mockPrisma.attendanceRecord.upsert).not.toHaveBeenCalled()
    })
  })

  describe('Check-out với ảnh Selfie', () => {
    it('lưu ảnh checkOutPhoto khi check-out thành công', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(sampleEmployee)
      mockPrisma.attendanceRecord.findUnique.mockResolvedValue({
        id: 'att_rec_1',
        checkInTime: new Date(Date.now() - 8 * 3600 * 1000), // 8 giờ trước
        checkOutTime: null,
        status: 'PRESENT',
      })

      mockPrisma.attendanceRecord.update.mockImplementation(({ data }) => {
        return Promise.resolve({
          id: 'att_rec_1',
          checkOutTime: new Date(),
          checkOutPhoto: data.checkOutPhoto,
          workDuration: 8,
          workDays: 1,
          isEarlyLeave: false,
          earlyMinutes: 0,
        })
      })

      const req = new NextRequest('http://localhost:3000/api/attendance/check-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: branchHN.latitude,
          longitude: branchHN.longitude,
          accuracy: 10,
          photo: sampleBase64Png,
        }),
      })

      const res = await checkOutHandler(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data.checkOutPhoto).toMatch(/^\/uploads\/attendance\//)
      expect(mockPrisma.attendanceRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            checkOutPhoto: expect.stringMatching(/^\/uploads\/attendance\//),
          }),
        })
      )

      // Cleanup
      const fullPath = path.join(process.cwd(), 'public', json.data.checkOutPhoto.replace(/^\//, ''))
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath)
    })

    it('trả về 422 nếu ảnh check-out có định dạng không được hỗ trợ', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(sampleEmployee)
      mockPrisma.attendanceRecord.findUnique.mockResolvedValue({
        id: 'att_rec_1',
        checkInTime: new Date(Date.now() - 8 * 3600 * 1000),
        checkOutTime: null,
        status: 'PRESENT',
      })

      const req = new NextRequest('http://localhost:3000/api/attendance/check-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: branchHN.latitude,
          longitude: branchHN.longitude,
          accuracy: 10,
          photo: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
        }),
      })

      const res = await checkOutHandler(req)
      const json = await res.json()

      expect(res.status).toBe(422)
      expect(json.success).toBe(false)
      expect(mockPrisma.attendanceRecord.update).not.toHaveBeenCalled()
    })
  })

  describe('Admin Records API: Hỗ trợ đối soát Selfie & Khoảng cách GPS', () => {
    it('trả về thông tin chi nhánh gồm latitude, longitude, gpsRadius và ảnh selfie để hiển thị khoảng cách', async () => {
      mockSession.mockResolvedValue({
        user: {
          id: 'usr_admin',
          email: 'admin@demo.com',
          role: 'SUPER_ADMIN',
        },
      })

      const sampleRecordWithPhotos = {
        id: 'att_rec_audit_1',
        date: new Date('2026-11-11'),
        checkInTime: new Date('2026-11-11T08:05:00Z'),
        checkInLat: 21.02852,
        checkInLon: 105.83418,
        checkInAccuracy: 8,
        checkInDevice: 'Chrome/120.0',
        checkInPhoto: '/uploads/attendance/selfie_emp1_in.jpg',
        checkOutTime: new Date('2026-11-11T17:05:00Z'),
        checkOutLat: 21.02853,
        checkOutLon: 105.83419,
        checkOutAccuracy: 9,
        checkOutDevice: 'Chrome/120.0',
        checkOutPhoto: '/uploads/attendance/selfie_emp1_out.jpg',
        workDuration: 8,
        workDays: 1,
        status: 'PRESENT',
        employee: {
          id: 'emp_1',
          fullName: 'Nguyễn Văn A',
          employeeCode: 'NV001',
          position: 'Lập trình viên',
          avatarUrl: null,
          department: {
            id: 'dept_1',
            name: 'Kỹ thuật',
            code: 'TECH',
          },
          branch: {
            id: 'br_hn',
            name: 'Chi nhánh Hà Nội',
            code: 'HN',
            latitude: branchHN.latitude,
            longitude: branchHN.longitude,
            gpsRadius: branchHN.gpsRadius,
          },
        },
      }

      mockPrisma.attendanceRecord.count.mockResolvedValue(1)
      mockPrisma.attendanceRecord.findMany.mockResolvedValue([sampleRecordWithPhotos])

      const req = new NextRequest('http://localhost:3000/api/attendance/records?date=2026-11-11', {
        method: 'GET',
      })

      const res = await recordsHandler(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data.records).toHaveLength(1)
      const rec = json.data.records[0]
      expect(rec.checkInPhoto).toBe('/uploads/attendance/selfie_emp1_in.jpg')
      expect(rec.checkOutPhoto).toBe('/uploads/attendance/selfie_emp1_out.jpg')
      expect(rec.employee.branch.latitude).toBe(branchHN.latitude)
      expect(rec.employee.branch.longitude).toBe(branchHN.longitude)
      expect(rec.employee.branch.gpsRadius).toBe(100)
    })
  })
})
