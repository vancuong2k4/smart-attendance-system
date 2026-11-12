import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { UserRole } from '@prisma/client'

const { mockSession, mockPrisma } = vi.hoisted(() => {
  const prismaMock: any = {
    company: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    branch: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    employee: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    department: {
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
    workSchedule: {
      deleteMany: vi.fn(),
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

import { GET as getBranchesHandler, POST as postBranchesHandler } from '../src/app/api/branches/route'
import {
  GET as getBranchDetailHandler,
  PATCH as patchBranchHandler,
  DELETE as deleteBranchHandler,
} from '../src/app/api/branches/[id]/route'
import { POST as testGeofenceHandler } from '../src/app/api/branches/[id]/test-geofence/route'
import { GET as getBranchStatsHandler } from '../src/app/api/branches/stats/route'
import {
  calculateDistance,
  isInsideGeofence,
  getGeofenceBoundingBox,
  evaluateGeofenceTest,
  formatDistance,
} from '../src/lib/geofence'
import { branchCreateSchema, geofenceTestSchema } from '../src/lib/branch-validation'

describe('Branch & Geofence Management Feature', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ═══════════════════════════════════════════════════
  // 1. GEOFENCE MATHEMATICS & UTILITY TESTS
  // ═══════════════════════════════════════════════════
  describe('Geofence Math Utilities', () => {
    it('tính khoảng cách giữa 2 tọa độ trùng nhau là 0 mét', () => {
      const dist = calculateDistance(21.0285, 105.8544, 21.0285, 105.8544)
      expect(dist).toBe(0)
    })

    it('tính chính xác khoảng cách giữa Nhà hát Lớn Hà Nội và Lăng Bác (~2.7km)', () => {
      // Hanoi Opera House: 21.0245, 105.8575
      // Ho Chi Minh Mausoleum: 21.0368, 105.8346
      const dist = calculateDistance(21.0245, 105.8575, 21.0368, 105.8346)
      expect(dist).toBeGreaterThan(2500)
      expect(dist).toBeLessThan(3000)
    })

    it('xác định đúng tọa độ nằm trong bán kính geofence (isInsideGeofence)', () => {
      // Điểm cách nhau ~30 mét
      const centerLat = 21.028511
      const centerLon = 105.854444
      const nearbyLat = 21.028711 // delta ~22m
      const nearbyLon = 105.854544 // delta ~10m

      const inside = isInsideGeofence(nearbyLat, nearbyLon, centerLat, centerLon, 100)
      expect(inside).toBe(true)

      const outside = isInsideGeofence(nearbyLat, nearbyLon, centerLat, centerLon, 10)
      expect(outside).toBe(false)
    })

    it('tính bounding box chuẩn xác cho việc zoom bản đồ', () => {
      const bbox = getGeofenceBoundingBox(21.0285, 105.8544, 200)
      expect(bbox.minLat).toBeLessThan(21.0285)
      expect(bbox.maxLat).toBeGreaterThan(21.0285)
      expect(bbox.minLon).toBeLessThan(105.8544)
      expect(bbox.maxLon).toBeGreaterThan(105.8544)
    })

    it('định dạng khoảng cách formatDistance hiển thị m và km chính xác', () => {
      expect(formatDistance(50)).toBe('50 m')
      expect(formatDistance(999)).toBe('999 m')
      expect(formatDistance(1250)).toBe('1.25 km')
    })

    it('đánh giá điểm thử nghiệm evaluateGeofenceTest trả về INSIDE hoặc OUTSIDE kèm báo cáo', () => {
      const evalInside = evaluateGeofenceTest(21.0285, 105.8544, 100, 21.0285, 105.8544)
      expect(evalInside.isInside).toBe(true)
      expect(evalInside.verdict).toBe('INSIDE')
      expect(evalInside.distanceMeters).toBe(0)

      const evalOutside = evaluateGeofenceTest(21.0285, 105.8544, 50, 21.0585, 105.8944)
      expect(evalOutside.isInside).toBe(false)
      expect(evalOutside.verdict).toBe('OUTSIDE')
      expect(evalOutside.deltaMeters).toBeGreaterThan(0)
    })
  })

  // ═══════════════════════════════════════════════════
  // 2. VALIDATION SCHEMA TESTS
  // ═══════════════════════════════════════════════════
  describe('Branch & Geofence Validation Schemas', () => {
    it('chấp nhận dữ liệu hợp lệ và tự động chuẩn hóa mã chi nhánh thành chữ hoa', () => {
      const parsed = branchCreateSchema.parse({
        name: 'Chi nhánh Cầu Giấy',
        code: 'hn-cg01',
        latitude: 21.033333,
        longitude: 105.783333,
        gpsRadius: 150,
      })
      expect(parsed.name).toBe('Chi nhánh Cầu Giấy')
      expect(parsed.code).toBe('HN-CG01')
      expect(parsed.gpsRadius).toBe(150)
      expect(parsed.isActive).toBe(true)
    })

    it('từ chối tọa độ ngoài giới hạn chuẩn [-90..90] hoặc [-180..180]', () => {
      const res = branchCreateSchema.safeParse({
        name: 'Chi nhánh Test',
        code: 'TEST01',
        latitude: 95.0, // vượt quá 90
        longitude: 105.0,
      })
      expect(res.success).toBe(false)
    })

    it('từ chối bán kính geofence nhỏ hơn 20 mét hoặc lớn hơn 5000 mét', () => {
      const resTooSmall = branchCreateSchema.safeParse({
        name: 'Chi nhánh Test',
        code: 'TEST01',
        latitude: 21.0,
        longitude: 105.0,
        gpsRadius: 10,
      })
      expect(resTooSmall.success).toBe(false)

      const resTooLarge = branchCreateSchema.safeParse({
        name: 'Chi nhánh Test',
        code: 'TEST01',
        latitude: 21.0,
        longitude: 105.0,
        gpsRadius: 6000,
      })
      expect(resTooLarge.success).toBe(false)
    })
  })

  // ═══════════════════════════════════════════════════
  // 3. GET /api/branches
  // ═══════════════════════════════════════════════════
  describe('GET /api/branches', () => {
    it('trả về 401 nếu chưa đăng nhập', async () => {
      mockSession.mockResolvedValueOnce(null)
      const req = new NextRequest('http://localhost/api/branches')
      const res = await getBranchesHandler(req)
      expect(res.status).toBe(401)
    })

    it('trả về danh sách chi nhánh thành công kèm điều kiện lọc status và search', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'u1', role: UserRole.SUPER_ADMIN },
      })

      const mockData = [
        {
          id: 'b1',
          name: 'Trụ sở chính Hà Nội',
          code: 'HN-HQ',
          latitude: 21.0285,
          longitude: 105.8544,
          gpsRadius: 100,
          isActive: true,
        },
      ]

      mockPrisma.branch.findMany.mockResolvedValueOnce(mockData)

      const req = new NextRequest(
        'http://localhost/api/branches?status=active&search=Hà+Nội&includeCounts=true'
      )
      const res = await getBranchesHandler(req)
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data).toHaveLength(1)
      expect(mockPrisma.branch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            OR: expect.any(Array),
          }),
        })
      )
    })
  })

  // ═══════════════════════════════════════════════════
  // 4. POST /api/branches
  // ═══════════════════════════════════════════════════
  describe('POST /api/branches', () => {
    it('trả về 401 nếu chưa đăng nhập', async () => {
      mockSession.mockResolvedValueOnce(null)
      const req = new NextRequest('http://localhost/api/branches', { method: 'POST' })
      const res = await postBranchesHandler(req)
      expect(res.status).toBe(401)
    })

    it('trả về 403 nếu tài khoản không phải SUPER_ADMIN', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'u2', role: UserRole.EMPLOYEE },
      })

      const req = new NextRequest('http://localhost/api/branches', {
        method: 'POST',
        body: JSON.stringify({ name: 'Chi nhánh Mới', code: 'NEW01' }),
      })
      const res = await postBranchesHandler(req)
      expect(res.status).toBe(403)
    })

    it('trả về 409 nếu mã chi nhánh đã tồn tại trong công ty', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'u1', role: UserRole.SUPER_ADMIN },
      })

      mockPrisma.company.findFirst.mockResolvedValueOnce({ id: 'comp1', code: 'HQ' })
      mockPrisma.branch.findUnique.mockResolvedValueOnce({ id: 'existing_b1', code: 'HN01' })

      const req = new NextRequest('http://localhost/api/branches', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Trụ sở Hà Nội',
          code: 'HN01',
          latitude: 21.0285,
          longitude: 105.8544,
          gpsRadius: 100,
        }),
      })

      const res = await postBranchesHandler(req)
      expect(res.status).toBe(409)
    })

    it('tạo thành công chi nhánh mới và tự tạo công ty mặc định nếu chưa có', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'u1', role: UserRole.SUPER_ADMIN },
      })

      mockPrisma.company.findFirst.mockResolvedValueOnce(null)
      mockPrisma.company.create.mockResolvedValueOnce({ id: 'new_comp', code: 'HQ' })
      mockPrisma.branch.findUnique.mockResolvedValueOnce(null)
      mockPrisma.branch.create.mockResolvedValueOnce({
        id: 'new_branch_id',
        name: 'Chi nhánh Đà Nẵng',
        code: 'DN01',
        latitude: 16.0544,
        longitude: 108.2022,
        gpsRadius: 120,
        isActive: true,
      })

      const req = new NextRequest('http://localhost/api/branches', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Chi nhánh Đà Nẵng',
          code: 'dn01',
          latitude: 16.0544,
          longitude: 108.2022,
          gpsRadius: 120,
        }),
      })

      const res = await postBranchesHandler(req)
      const body = await res.json()

      expect(res.status).toBe(201)
      expect(body.success).toBe(true)
      expect(body.data.id).toBe('new_branch_id')
      expect(mockPrisma.branch.create).toHaveBeenCalled()
    })
  })

  // ═══════════════════════════════════════════════════
  // 5. GET /api/branches/[id]
  // ═══════════════════════════════════════════════════
  describe('GET /api/branches/[id]', () => {
    it('trả về 404 nếu không tìm thấy chi nhánh', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'u1', role: UserRole.SUPER_ADMIN },
      })
      mockPrisma.branch.findUnique.mockResolvedValueOnce(null)

      const req = new NextRequest('http://localhost/api/branches/unknown')
      const res = await getBranchDetailHandler(req, {
        params: Promise.resolve({ id: 'unknown' }),
      })
      expect(res.status).toBe(404)
    })

    it('trả về chi tiết chi nhánh kèm danh sách phòng ban và số lượng nhân sự', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'u1', role: UserRole.SUPER_ADMIN },
      })

      mockPrisma.branch.findUnique.mockResolvedValueOnce({
        id: 'b1',
        name: 'Trụ sở chính Hà Nội',
        code: 'HN-HQ',
        latitude: 21.0285,
        longitude: 105.8544,
        gpsRadius: 100,
        departments: [{ id: 'd1', name: 'Phòng Kỹ thuật' }],
        schedules: [],
        _count: { employees: 25, departments: 1, schedules: 0 },
      })

      const req = new NextRequest('http://localhost/api/branches/b1')
      const res = await getBranchDetailHandler(req, {
        params: Promise.resolve({ id: 'b1' }),
      })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.data.id).toBe('b1')
      expect(body.data._count.employees).toBe(25)
    })
  })

  // ═══════════════════════════════════════════════════
  // 6. PATCH /api/branches/[id]
  // ═══════════════════════════════════════════════════
  describe('PATCH /api/branches/[id]', () => {
    it('chặn BRANCH_ADMIN sửa chi nhánh không thuộc phạm vi quản lý', async () => {
      mockSession.mockResolvedValueOnce({
        user: {
          id: 'u_admin',
          role: UserRole.BRANCH_ADMIN,
          employee: { branchId: 'other_branch' },
        },
      })

      const req = new NextRequest('http://localhost/api/branches/b1', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Hacked Name' }),
      })

      const res = await patchBranchHandler(req, {
        params: Promise.resolve({ id: 'b1' }),
      })
      expect(res.status).toBe(403)
    })

    it('cập nhật thành công tọa độ và bán kính geofence của chi nhánh', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'u1', role: UserRole.SUPER_ADMIN },
      })

      mockPrisma.branch.findUnique.mockResolvedValueOnce({
        id: 'b1',
        companyId: 'comp1',
        code: 'HN01',
      })

      mockPrisma.branch.update.mockResolvedValueOnce({
        id: 'b1',
        name: 'Trụ sở HN Mới',
        latitude: 21.029,
        longitude: 105.855,
        gpsRadius: 200,
      })

      const req = new NextRequest('http://localhost/api/branches/b1', {
        method: 'PATCH',
        body: JSON.stringify({
          name: 'Trụ sở HN Mới',
          latitude: 21.029,
          longitude: 105.855,
          gpsRadius: 200,
        }),
      })

      const res = await patchBranchHandler(req, {
        params: Promise.resolve({ id: 'b1' }),
      })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(mockPrisma.branch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'b1' },
          data: expect.objectContaining({ gpsRadius: 200 }),
        })
      )
    })
  })

  // ═══════════════════════════════════════════════════
  // 7. DELETE /api/branches/[id]
  // ═══════════════════════════════════════════════════
  describe('DELETE /api/branches/[id]', () => {
    it('chặn xóa chi nhánh nếu vẫn còn nhân sự liên kết (_count.employees > 0)', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'u1', role: UserRole.SUPER_ADMIN },
      })

      mockPrisma.branch.findUnique.mockResolvedValueOnce({
        id: 'b1',
        name: 'Chi nhánh Hà Nội',
        code: 'HN01',
        _count: { employees: 12, departments: 2 },
      })

      const req = new NextRequest('http://localhost/api/branches/b1', {
        method: 'DELETE',
      })

      const res = await deleteBranchHandler(req, {
        params: Promise.resolve({ id: 'b1' }),
      })
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.message).toContain('12 nhân sự')
      expect(mockPrisma.branch.delete).not.toHaveBeenCalled()
    })

    it('cho phép xóa chi nhánh an toàn khi không còn nhân viên nào', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'u1', role: UserRole.SUPER_ADMIN },
      })

      mockPrisma.branch.findUnique.mockResolvedValueOnce({
        id: 'b_empty',
        name: 'Chi nhánh Rỗng',
        code: 'EMPTY01',
        _count: { employees: 0, departments: 0 },
      })

      const req = new NextRequest('http://localhost/api/branches/b_empty', {
        method: 'DELETE',
      })

      const res = await deleteBranchHandler(req, {
        params: Promise.resolve({ id: 'b_empty' }),
      })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(mockPrisma.$transaction).toHaveBeenCalled()
    })
  })

  // ═══════════════════════════════════════════════════
  // 8. POST /api/branches/[id]/test-geofence
  // ═══════════════════════════════════════════════════
  describe('POST /api/branches/[id]/test-geofence', () => {
    it('trả về INSIDE khi tọa độ thử nghiệm nằm trong bán kính geofence', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'u1', role: UserRole.SUPER_ADMIN },
      })

      mockPrisma.branch.findUnique.mockResolvedValueOnce({
        id: 'b1',
        name: 'Chi nhánh Test',
        code: 'TEST01',
        latitude: 21.028511,
        longitude: 105.854444,
        gpsRadius: 100,
        isActive: true,
      })

      const req = new NextRequest('http://localhost/api/branches/b1/test-geofence', {
        method: 'POST',
        body: JSON.stringify({
          latitude: 21.02852,
          longitude: 105.85445,
          accuracy: 10,
        }),
      })

      const res = await testGeofenceHandler(req, {
        params: Promise.resolve({ id: 'b1' }),
      })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.data.isInside).toBe(true)
      expect(body.data.verdict).toBe('INSIDE')
      expect(body.data.distanceMeters).toBeLessThan(100)
    })

    it('trả về OUTSIDE khi tọa độ thử nghiệm nằm ngoài bán kính geofence', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'u1', role: UserRole.SUPER_ADMIN },
      })

      mockPrisma.branch.findUnique.mockResolvedValueOnce({
        id: 'b1',
        name: 'Chi nhánh Test',
        code: 'TEST01',
        latitude: 21.028511,
        longitude: 105.854444,
        gpsRadius: 50,
        isActive: true,
      })

      const req = new NextRequest('http://localhost/api/branches/b1/test-geofence', {
        method: 'POST',
        body: JSON.stringify({
          latitude: 21.048511, // cách xa ~2.2km
          longitude: 105.854444,
        }),
      })

      const res = await testGeofenceHandler(req, {
        params: Promise.resolve({ id: 'b1' }),
      })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.data.isInside).toBe(false)
      expect(body.data.verdict).toBe('OUTSIDE')
      expect(body.data.distanceMeters).toBeGreaterThan(50)
    })

    it('trả về 404 nếu không tìm thấy chi nhánh khi test geofence', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'u1', role: UserRole.SUPER_ADMIN },
      })
      mockPrisma.branch.findUnique.mockResolvedValueOnce(null)

      const req = new NextRequest('http://localhost/api/branches/unknown/test-geofence', {
        method: 'POST',
        body: JSON.stringify({ latitude: 21.0, longitude: 105.0 }),
      })
      const res = await testGeofenceHandler(req, {
        params: Promise.resolve({ id: 'unknown' }),
      })
      expect(res.status).toBe(404)
    })

    it('trả về 422 nếu thiếu tọa độ hoặc tọa độ không hợp lệ', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'u1', role: UserRole.SUPER_ADMIN },
      })
      mockPrisma.branch.findUnique.mockResolvedValueOnce({
        id: 'b1',
        latitude: 21.0,
        longitude: 105.0,
        gpsRadius: 100,
      })

      const req = new NextRequest('http://localhost/api/branches/b1/test-geofence', {
        method: 'POST',
        body: JSON.stringify({ latitude: 120.0, longitude: 105.0 }), // lat > 90
      })
      const res = await testGeofenceHandler(req, {
        params: Promise.resolve({ id: 'b1' }),
      })
      expect(res.status).toBe(422)
    })
  })

  // ═══════════════════════════════════════════════════
  // 9. GET /api/branches/stats
  // ═══════════════════════════════════════════════════
  describe('GET /api/branches/stats', () => {
    it('xử lý an toàn khi hệ thống chưa có chi nhánh nào (0 branches)', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'u1', role: UserRole.SUPER_ADMIN },
      })

      mockPrisma.branch.count.mockResolvedValueOnce(0)
      mockPrisma.branch.count.mockResolvedValueOnce(0)
      mockPrisma.employee.count.mockResolvedValueOnce(0)
      mockPrisma.department.count.mockResolvedValueOnce(0)
      mockPrisma.branch.findMany.mockResolvedValueOnce([])

      const req = new NextRequest('http://localhost/api/branches/stats')
      const res = await getBranchStatsHandler(req)
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.data.totalBranches).toBe(0)
      expect(body.data.averageRadius).toBe(100)
    })

    it('tổng hợp chính xác các chỉ số thống kê mạng lưới chi nhánh', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'u1', role: UserRole.SUPER_ADMIN },
      })

      mockPrisma.branch.count.mockResolvedValueOnce(5) // total
      mockPrisma.branch.count.mockResolvedValueOnce(4) // active
      mockPrisma.employee.count.mockResolvedValueOnce(120) // employees
      mockPrisma.department.count.mockResolvedValueOnce(15) // departments
      mockPrisma.branch.findMany.mockResolvedValueOnce([
        { gpsRadius: 50 },
        { gpsRadius: 100 },
        { gpsRadius: 150 },
      ])

      const req = new NextRequest('http://localhost/api/branches/stats')
      const res = await getBranchStatsHandler(req)
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.data.totalBranches).toBe(5)
      expect(body.data.activeBranches).toBe(4)
      expect(body.data.inactiveBranches).toBe(1)
      expect(body.data.totalEmployees).toBe(120)
      expect(body.data.averageRadius).toBe(100)
      expect(body.data.minRadius).toBe(50)
      expect(body.data.maxRadius).toBe(150)
    })
  })
})
