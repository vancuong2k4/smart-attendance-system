import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import * as XLSX from 'xlsx'

const { mockSession, mockPrisma } = vi.hoisted(() => {
  const prismaMock: any = {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    employee: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    branch: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    department: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
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

import { GET as getEmployeesHandler, POST as postEmployeesHandler } from '../src/app/api/employees/route'
import {
  GET as getEmployeeDetailHandler,
  PATCH as patchEmployeeHandler,
  DELETE as deleteEmployeeHandler,
} from '../src/app/api/employees/[id]/route'
import { GET as getTemplateHandler } from '../src/app/api/employees/template/route'
import { POST as importEmployeesHandler } from '../src/app/api/employees/import/route'

describe('Employee Management API Routes', () => {
  const sampleBranchHN = {
    id: 'br_hn',
    code: 'CN-HN',
    name: 'Chi nhánh Hà Nội',
    isActive: true,
  }

  const sampleBranchHCM = {
    id: 'br_hcm',
    code: 'CN-HCM',
    name: 'Chi nhánh Hồ Chí Minh',
    isActive: true,
  }

  const sampleDeptIT = {
    id: 'dept_it',
    branchId: 'br_hn',
    code: 'PB-IT',
    name: 'Phòng Công nghệ Thông tin',
  }

  const sampleDeptSales = {
    id: 'dept_sales',
    branchId: 'br_hn',
    code: 'PB-KD',
    name: 'Phòng Kinh doanh',
  }

  const sampleEmployee = {
    id: 'emp_1',
    userId: 'usr_1',
    employeeCode: 'NV001',
    fullName: 'Nguyễn Văn A',
    position: 'Kỹ sư phần mềm',
    phoneNumber: '0901234567',
    address: 'Hà Nội',
    branchId: 'br_hn',
    departmentId: 'dept_it',
    employmentType: 'FULL_TIME',
    annualLeaveBalance: 12,
    sickLeaveBalance: 10,
    startDate: new Date('2024-01-01'),
    endDate: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: {
      id: 'usr_1',
      email: 'a.nguyen@example.com',
      role: 'EMPLOYEE',
      isActive: true,
      lastLoginAt: null,
      createdAt: new Date(),
    },
    branch: sampleBranchHN,
    department: sampleDeptIT,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.branch.findMany.mockResolvedValue([sampleBranchHN, sampleBranchHCM])
    mockPrisma.branch.findUnique.mockResolvedValue(sampleBranchHN)
    mockPrisma.department.findMany.mockResolvedValue([sampleDeptIT, sampleDeptSales])
    mockPrisma.department.findUnique.mockResolvedValue(sampleDeptIT)
  })

  // ==========================================
  // 1. GET /api/employees
  // ==========================================
  describe('GET /api/employees', () => {
    it('trả về 401 nếu chưa đăng nhập', async () => {
      mockSession.mockResolvedValue(null)

      const req = new NextRequest('http://localhost:3000/api/employees')
      const res = await getEmployeesHandler(req)
      const json = await res.json()

      expect(res.status).toBe(401)
      expect(json.success).toBe(false)
    })

    it('trả về 403 nếu tài khoản có role EMPLOYEE', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr_emp', role: 'EMPLOYEE', employee: { id: 'emp_1', branchId: 'br_hn' } },
      })

      const req = new NextRequest('http://localhost:3000/api/employees')
      const res = await getEmployeesHandler(req)
      const json = await res.json()

      expect(res.status).toBe(403)
      expect(json.success).toBe(false)
      expect(json.message).toContain('không có quyền truy cập')
    })

    it('SUPER_ADMIN xem được danh sách nhân viên kèm phân trang và thống kê', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr_super', role: 'SUPER_ADMIN' },
      })

      mockPrisma.employee.count
        .mockResolvedValueOnce(1) // total filtered
        .mockResolvedValueOnce(5) // total in scope
        .mockResolvedValueOnce(3) // active
        .mockResolvedValueOnce(1) // probation
        .mockResolvedValueOnce(1) // inactive
      mockPrisma.employee.findMany.mockResolvedValue([sampleEmployee])

      const req = new NextRequest('http://localhost:3000/api/employees?page=1&limit=10')
      const res = await getEmployeesHandler(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data.employees).toHaveLength(1)
      expect(json.data.pagination.total).toBe(1)
      expect(json.data.stats).toEqual({
        total: 5,
        active: 3,
        probation: 1,
        inactive: 1,
      })
    })

    it('BRANCH_ADMIN bị ép buộc chỉ xem nhân viên chi nhánh của mình', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr_ba', role: 'BRANCH_ADMIN', employee: { id: 'emp_ba', branchId: 'br_hn' } },
      })

      mockPrisma.employee.count.mockResolvedValue(1)
      mockPrisma.employee.findMany.mockResolvedValue([sampleEmployee])

      // Query cố tình truyền branchId khác (br_hcm)
      const req = new NextRequest('http://localhost:3000/api/employees?branchId=br_hcm')
      const res = await getEmployeesHandler(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(mockPrisma.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            branchId: 'br_hn', // Bị ép về chi nhánh của BRANCH_ADMIN
          }),
        })
      )
    })

    it('hỗ trợ tìm kiếm theo search và lọc theo status', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr_hr', role: 'HR_MANAGER' },
      })

      mockPrisma.employee.count.mockResolvedValue(1)
      mockPrisma.employee.findMany.mockResolvedValue([sampleEmployee])

      const req = new NextRequest('http://localhost:3000/api/employees?search=Nguyễn&status=ACTIVE')
      const res = await getEmployeesHandler(req)

      expect(res.status).toBe(200)
      expect(mockPrisma.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.any(Array),
            employmentType: { not: 'PROBATION' },
          }),
        })
      )
    })
  })

  // ==========================================
  // 2. POST /api/employees
  // ==========================================
  describe('POST /api/employees', () => {
    it('trả về 403 nếu EMPLOYEE cố tạo nhân viên', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr_emp', role: 'EMPLOYEE' },
      })

      const req = new NextRequest('http://localhost:3000/api/employees', {
        method: 'POST',
        body: JSON.stringify({}),
      })
      const res = await postEmployeesHandler(req)

      expect(res.status).toBe(403)
    })

    it('trả về 422 nếu thiếu trường bắt buộc', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr_hr', role: 'HR_MANAGER' },
      })

      const req = new NextRequest('http://localhost:3000/api/employees', {
        method: 'POST',
        body: JSON.stringify({
          fullName: 'Test User',
          // Thiếu email, employeeCode, branchId, departmentId
        }),
      })
      const res = await postEmployeesHandler(req)
      const json = await res.json()

      expect(res.status).toBe(422)
      expect(json.success).toBe(false)
    })

    it('trả về 409 nếu trùng email', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr_hr', role: 'HR_MANAGER' },
      })
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing_usr', email: 'dup@example.com' })

      const req = new NextRequest('http://localhost:3000/api/employees', {
        method: 'POST',
        body: JSON.stringify({
          fullName: 'Trùng Email',
          email: 'dup@example.com',
          employeeCode: 'NV999',
          branchId: 'br_hn',
          departmentId: 'dept_it',
        }),
      })
      const res = await postEmployeesHandler(req)
      const json = await res.json()

      expect(res.status).toBe(409)
      expect(json.message).toContain('Email đã tồn tại')
    })

    it('trả về 409 nếu trùng mã nhân viên', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr_hr', role: 'HR_MANAGER' },
      })
      mockPrisma.user.findUnique.mockResolvedValue(null)
      mockPrisma.employee.findUnique.mockResolvedValue({ id: 'existing_emp', employeeCode: 'NV001' })

      const req = new NextRequest('http://localhost:3000/api/employees', {
        method: 'POST',
        body: JSON.stringify({
          fullName: 'Trùng Mã',
          email: 'unique@example.com',
          employeeCode: 'NV001',
          branchId: 'br_hn',
          departmentId: 'dept_it',
        }),
      })
      const res = await postEmployeesHandler(req)
      const json = await res.json()

      expect(res.status).toBe(409)
      expect(json.message).toContain('Mã nhân viên đã tồn tại')
    })

    it('trả về 403 nếu BRANCH_ADMIN tạo nhân viên cho chi nhánh khác', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr_ba', role: 'BRANCH_ADMIN', employee: { id: 'emp_ba', branchId: 'br_hn' } },
      })

      const req = new NextRequest('http://localhost:3000/api/employees', {
        method: 'POST',
        body: JSON.stringify({
          fullName: 'Nhân viên HCM',
          email: 'new.hcm@example.com',
          employeeCode: 'NV_HCM_1',
          branchId: 'br_hcm', // Khác chi nhánh br_hn
          departmentId: 'dept_sales',
        }),
      })
      const res = await postEmployeesHandler(req)
      const json = await res.json()

      expect(res.status).toBe(403)
      expect(json.message).toContain('chỉ có quyền tạo nhân viên trong chi nhánh của mình')
    })

    it('trả về 403 nếu BRANCH_ADMIN cố tạo nhân viên với vai trò HR_MANAGER', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr_ba', role: 'BRANCH_ADMIN', employee: { id: 'emp_ba', branchId: 'br_hn' } },
      })

      const req = new NextRequest('http://localhost:3000/api/employees', {
        method: 'POST',
        body: JSON.stringify({
          fullName: 'Nhân viên HR Mới',
          email: 'hr.new@example.com',
          employeeCode: 'NV_HR_1',
          branchId: 'br_hn',
          departmentId: 'dept_it',
          role: 'HR_MANAGER',
        }),
      })
      const res = await postEmployeesHandler(req)
      const json = await res.json()

      expect(res.status).toBe(403)
      expect(json.message).toContain('Bạn không có quyền')
    })

    it('trả về 422 nếu phòng ban không thuộc chi nhánh chỉ định', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr_admin', role: 'SUPER_ADMIN' },
      })
      // sampleDeptHCM thuộc br_hcm, nhưng branchId truyền vào là br_hn
      mockPrisma.branch.findUnique.mockResolvedValue(sampleBranchHN)
      mockPrisma.department.findUnique.mockResolvedValue({
        id: 'dept_hcm_sales',
        branchId: 'br_hcm',
        name: 'Phòng KD HCM',
      })
      mockPrisma.user.findUnique.mockResolvedValue(null)
      mockPrisma.employee.findUnique.mockResolvedValue(null)

      const req = new NextRequest('http://localhost:3000/api/employees', {
        method: 'POST',
        body: JSON.stringify({
          fullName: 'Lệch Phòng Ban',
          email: 'mismatch@example.com',
          employeeCode: 'NV_MISMATCH',
          branchId: 'br_hn',
          departmentId: 'dept_hcm_sales',
        }),
      })
      const res = await postEmployeesHandler(req)
      const json = await res.json()

      expect(res.status).toBe(422)
      expect(json.message).toContain('không thuộc chi nhánh chỉ định')
    })

    it('tạo thành công nhân viên kèm tài khoản User với mật khẩu được băm', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr_hr', role: 'HR_MANAGER' },
      })
      mockPrisma.user.findUnique.mockResolvedValue(null)
      mockPrisma.employee.findUnique.mockResolvedValue(null)
      mockPrisma.user.create.mockResolvedValue({
        id: 'usr_new',
        email: 'new.emp@example.com',
        role: 'EMPLOYEE',
      })
      mockPrisma.employee.create.mockResolvedValue({
        ...sampleEmployee,
        id: 'emp_new',
        userId: 'usr_new',
        employeeCode: 'NV999',
        fullName: 'Nguyễn Văn Mới',
      })

      const req = new NextRequest('http://localhost:3000/api/employees', {
        method: 'POST',
        body: JSON.stringify({
          fullName: 'Nguyễn Văn Mới',
          email: 'new.emp@example.com',
          employeeCode: 'NV999',
          branchId: 'br_hn',
          departmentId: 'dept_it',
          position: 'Lập trình viên React',
          phoneNumber: '0988888888',
        }),
      })
      const res = await postEmployeesHandler(req)
      const json = await res.json()

      expect(res.status).toBe(201)
      expect(json.success).toBe(true)
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'new.emp@example.com',
            role: 'EMPLOYEE',
            isActive: true,
          }),
        })
      )
    })
  })

  // ==========================================
  // 3. GET /api/employees/[id]
  // ==========================================
  describe('GET /api/employees/[id]', () => {
    it('trả về 404 nếu không tìm thấy nhân viên', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr_admin', role: 'SUPER_ADMIN' },
      })
      mockPrisma.employee.findUnique.mockResolvedValue(null)

      const req = new NextRequest('http://localhost:3000/api/employees/emp_not_found')
      const res = await getEmployeeDetailHandler(req, {
        params: Promise.resolve({ id: 'emp_not_found' }),
      })

      expect(res.status).toBe(404)
    })

    it('EMPLOYEE chỉ được xem hồ sơ chính mình, xem người khác trả về 403', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr_other', role: 'EMPLOYEE', employee: { id: 'emp_other' } },
      })
      mockPrisma.employee.findUnique.mockResolvedValue(sampleEmployee)

      const req = new NextRequest('http://localhost:3000/api/employees/emp_1')
      const res = await getEmployeeDetailHandler(req, {
        params: Promise.resolve({ id: 'emp_1' }),
      })

      expect(res.status).toBe(403)
    })

    it('EMPLOYEE xem hồ sơ của chính mình thành công', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr_1', role: 'EMPLOYEE', employee: { id: 'emp_1' } },
      })
      mockPrisma.employee.findUnique.mockResolvedValue(sampleEmployee)

      const req = new NextRequest('http://localhost:3000/api/employees/emp_1')
      const res = await getEmployeeDetailHandler(req, {
        params: Promise.resolve({ id: 'emp_1' }),
      })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.data.id).toBe('emp_1')
    })
  })

  // ==========================================
  // 4. PATCH /api/employees/[id]
  // ==========================================
  describe('PATCH /api/employees/[id]', () => {
    it('trả về 403 nếu EMPLOYEE cố tình cập nhật hồ sơ', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr_1', role: 'EMPLOYEE', employee: { id: 'emp_1' } },
      })

      const req = new NextRequest('http://localhost:3000/api/employees/emp_1', {
        method: 'PATCH',
        body: JSON.stringify({ fullName: 'Cập nhật tên' }),
      })
      const res = await patchEmployeeHandler(req, {
        params: Promise.resolve({ id: 'emp_1' }),
      })

      expect(res.status).toBe(403)
    })

    it('trả về 409 nếu sửa mã nhân viên trùng với người khác', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr_admin', role: 'SUPER_ADMIN' },
      })
      mockPrisma.employee.findUnique
        .mockResolvedValueOnce(sampleEmployee) // tìm emp hiện tại
        .mockResolvedValueOnce({ id: 'emp_conflict', employeeCode: 'NV002' }) // tìm trùng code

      const req = new NextRequest('http://localhost:3000/api/employees/emp_1', {
        method: 'PATCH',
        body: JSON.stringify({ employeeCode: 'NV002' }),
      })
      const res = await patchEmployeeHandler(req, {
        params: Promise.resolve({ id: 'emp_1' }),
      })

      expect(res.status).toBe(409)
    })

    it('trả về 403 nếu BRANCH_ADMIN cố nâng role lên HR_MANAGER khi PATCH', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr_ba', role: 'BRANCH_ADMIN', employee: { id: 'emp_ba', branchId: 'br_hn' } },
      })
      mockPrisma.employee.findUnique.mockResolvedValue(sampleEmployee)

      const req = new NextRequest('http://localhost:3000/api/employees/emp_1', {
        method: 'PATCH',
        body: JSON.stringify({ role: 'HR_MANAGER' }),
      })
      const res = await patchEmployeeHandler(req, {
        params: Promise.resolve({ id: 'emp_1' }),
      })
      const json = await res.json()

      expect(res.status).toBe(403)
      expect(json.message).toContain('Bạn không có quyền')
    })

    it('trả về 422 nếu PATCH phòng ban không thuộc chi nhánh nhân viên', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr_admin', role: 'SUPER_ADMIN' },
      })
      mockPrisma.employee.findUnique.mockResolvedValue(sampleEmployee) // branchId: br_hn
      mockPrisma.department.findUnique.mockResolvedValue({
        id: 'dept_hcm_foreign',
        branchId: 'br_hcm', // Chi nhánh khác
        name: 'Phòng HCM',
      })

      const req = new NextRequest('http://localhost:3000/api/employees/emp_1', {
        method: 'PATCH',
        body: JSON.stringify({ departmentId: 'dept_hcm_foreign' }),
      })
      const res = await patchEmployeeHandler(req, {
        params: Promise.resolve({ id: 'emp_1' }),
      })
      const json = await res.json()

      expect(res.status).toBe(422)
      expect(json.message).toContain('không thuộc chi nhánh này')
    })

    it('cập nhật thành công thông tin nhân viên', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr_admin', role: 'SUPER_ADMIN' },
      })
      mockPrisma.employee.findUnique.mockResolvedValue(sampleEmployee)
      mockPrisma.employee.update.mockResolvedValue({
        ...sampleEmployee,
        fullName: 'Nguyễn Văn Đã Đổi Tên',
        position: 'Trưởng phòng Kỹ thuật',
      })

      const req = new NextRequest('http://localhost:3000/api/employees/emp_1', {
        method: 'PATCH',
        body: JSON.stringify({
          fullName: 'Nguyễn Văn Đã Đổi Tên',
          position: 'Trưởng phòng Kỹ thuật',
        }),
      })
      const res = await patchEmployeeHandler(req, {
        params: Promise.resolve({ id: 'emp_1' }),
      })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.data.fullName).toBe('Nguyễn Văn Đã Đổi Tên')
    })
  })

  // ==========================================
  // 5. DELETE /api/employees/[id] (Soft Delete)
  // ==========================================
  describe('DELETE /api/employees/[id]', () => {
    it('trả về 400 nếu người dùng tự cho thôi việc chính mình', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr_1', role: 'SUPER_ADMIN' },
      })
      mockPrisma.employee.findUnique.mockResolvedValue(sampleEmployee) // sampleEmployee.userId === 'usr_1'

      const req = new NextRequest('http://localhost:3000/api/employees/emp_1', { method: 'DELETE' })
      const res = await deleteEmployeeHandler(req, {
        params: Promise.resolve({ id: 'emp_1' }),
      })
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.message).toContain('Không thể tự khóa')
    })

    it('soft delete nhân viên thành công: vô hiệu hoá tài khoản và set endDate', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr_admin', role: 'SUPER_ADMIN' },
      })
      mockPrisma.employee.findUnique.mockResolvedValue(sampleEmployee)

      const req = new NextRequest('http://localhost:3000/api/employees/emp_1', { method: 'DELETE' })
      const res = await deleteEmployeeHandler(req, {
        params: Promise.resolve({ id: 'emp_1' }),
      })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'usr_1' },
          data: { isActive: false },
        })
      )
      expect(mockPrisma.employee.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'emp_1' },
          data: expect.objectContaining({ endDate: expect.any(Date) }),
        })
      )
    })
  })

  // ==========================================
  // 6. GET /api/employees/template
  // ==========================================
  describe('GET /api/employees/template', () => {
    it('trả về 403 nếu EMPLOYEE cố tải template', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr_emp', role: 'EMPLOYEE' },
      })

      const req = new NextRequest('http://localhost:3000/api/employees/template')
      const res = await getTemplateHandler(req)

      expect(res.status).toBe(403)
    })

    it('tải file mẫu Excel hợp lệ cho quản trị viên', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr_hr', role: 'HR_MANAGER' },
      })

      const req = new NextRequest('http://localhost:3000/api/employees/template')
      const res = await getTemplateHandler(req)
      const buffer = await res.arrayBuffer()

      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toContain(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
      expect(buffer.byteLength).toBeGreaterThan(0)

      // Kiểm tra đọc lại được bằng thư viện xlsx
      const wb = XLSX.read(Buffer.from(buffer), { type: 'buffer' })
      expect(wb.SheetNames).toContain('Danh sách nhân viên')
      expect(wb.SheetNames).toContain('Hướng dẫn điền')
    })
  })

  // ==========================================
  // 7. POST /api/employees/import
  // ==========================================
  describe('POST /api/employees/import', () => {
    it('trả về 403 nếu EMPLOYEE gọi import', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr_emp', role: 'EMPLOYEE' },
      })

      const req = new NextRequest('http://localhost:3000/api/employees/import', {
        method: 'POST',
        body: JSON.stringify([]),
      })
      const res = await importEmployeesHandler(req)

      expect(res.status).toBe(403)
    })

    it('nhập thành công danh sách nhân viên qua JSON payload', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr_hr', role: 'HR_MANAGER' },
      })
      mockPrisma.user.findMany.mockResolvedValue([])
      mockPrisma.employee.findMany.mockResolvedValue([])
      mockPrisma.user.create.mockResolvedValue({ id: 'usr_imported_1' })
      mockPrisma.employee.create.mockResolvedValue({ id: 'emp_imported_1' })

      const rows = [
        {
          'Mã nhân viên': 'NV101',
          'Họ và tên': 'Trần Văn Một',
          Email: 'one.tran@example.com',
          'Số điện thoại': '0911111111',
          'Chức danh': 'Kế toán viên',
          'Mã chi nhánh': 'CN-HN',
          'Mã phòng ban': 'PB-KD',
          'Loại hợp đồng': 'Chính thức',
          'Ngày vào làm': '2024-03-01',
        },
        {
          'Mã nhân viên': 'NV102',
          'Họ và tên': 'Lê Thị Hai',
          Email: 'two.le@example.com',
          'Số điện thoại': '0922222222',
          'Chức danh': 'Nhân viên Kinh doanh',
          'Mã chi nhánh': 'CN-HN',
          'Mã phòng ban': 'PB-KD',
          'Loại hợp đồng': 'Thử việc',
          'Ngày vào làm': '2024-03-15',
        },
      ]

      const req = new NextRequest('http://localhost:3000/api/employees/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rows),
      })
      const res = await importEmployeesHandler(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.data.total).toBe(2)
      expect(json.data.importedCount).toBe(2)
      expect(json.data.skippedCount).toBe(0)
      expect(json.data.errors).toHaveLength(0)
    })

    it('báo cáo chi tiết các lỗi trùng lặp và thiếu trường bắt buộc', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr_hr', role: 'HR_MANAGER' },
      })
      // Giả lập email dup.emp@example.com đã có trong DB
      mockPrisma.user.findMany.mockResolvedValue([{ email: 'dup.emp@example.com' }])
      mockPrisma.employee.findMany.mockResolvedValue([])

      const rows = [
        {
          // Thiếu họ tên
          'Mã nhân viên': 'NV201',
          Email: 'missing.name@example.com',
          'Mã chi nhánh': 'CN-HN',
          'Mã phòng ban': 'PB-KD',
        },
        {
          // Email đã tồn tại trong DB
          'Mã nhân viên': 'NV202',
          'Họ và tên': 'Nguyễn Văn Trùng',
          Email: 'dup.emp@example.com',
          'Mã chi nhánh': 'CN-HN',
          'Mã phòng ban': 'PB-KD',
        },
        {
          // Trùng mã nhân viên nội bộ file với dòng tiếp theo
          'Mã nhân viên': 'NV_SAME',
          'Họ và tên': 'Người 1',
          Email: 'p1@example.com',
          'Mã chi nhánh': 'CN-HN',
          'Mã phòng ban': 'PB-KD',
        },
        {
          'Mã nhân viên': 'NV_SAME',
          'Họ và tên': 'Người 2',
          Email: 'p2@example.com',
          'Mã chi nhánh': 'CN-HN',
          'Mã phòng ban': 'PB-KD',
        },
      ]

      const req = new NextRequest('http://localhost:3000/api/employees/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rows),
      })
      const res = await importEmployeesHandler(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.data.total).toBe(4)
      expect(json.data.importedCount).toBe(1) // Chỉ 1 dòng hợp lệ (dòng p1)
      expect(json.data.skippedCount).toBe(3)
      expect(json.data.errors).toHaveLength(3)

      const errorTexts = json.data.errors.map((e: any) => e.error).join(';')
      expect(errorTexts).toContain('Thiếu họ và tên')
      expect(errorTexts).toContain('đã tồn tại trong hệ thống')
      expect(errorTexts).toContain('bị trùng lặp trong file')
    })

    it('trả về 400 nếu upload file không hợp lệ hoặc định dạng sai', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr_hr', role: 'HR_MANAGER' },
      })

      // File không đúng đuôi .xlsx/.xls
      const badForm = new FormData()
      badForm.append('file', new File(['content'], 'report.txt', { type: 'text/plain' }))

      const req = new NextRequest('http://localhost:3000/api/employees/import', {
        method: 'POST',
        body: badForm,
      })
      const res = await importEmployeesHandler(req)
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.message).toContain('Định dạng file không được hỗ trợ')
    })

    it('trả về 400 nếu upload file Excel bị hỏng', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr_hr', role: 'HR_MANAGER' },
      })

      const badForm = new FormData()
      badForm.append('file', new File([new Uint8Array([1, 2, 3, 4])], 'corrupt.xlsx', { type: 'application/vnd.ms-excel' }))

      const req = new NextRequest('http://localhost:3000/api/employees/import', {
        method: 'POST',
        body: badForm,
      })
      const res = await importEmployeesHandler(req)
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.message).toContain('Không thể đọc nội dung file Excel')
    })

    it('bỏ qua các dòng trống hoàn toàn và không gán nhầm branchCode thành employeeCode', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr_hr', role: 'HR_MANAGER' },
      })
      mockPrisma.user.findMany.mockResolvedValue([])
      mockPrisma.employee.findMany.mockResolvedValue([])
      mockPrisma.user.create.mockResolvedValue({ id: 'usr_1' })
      mockPrisma.employee.create.mockResolvedValue({ id: 'emp_1' })

      const rows = [
        {
          // Dòng hoàn toàn trống (do Excel để lại)
          'Mã nhân viên': '',
          'Họ và tên': '',
          Email: '',
        },
        {
          // Dòng cố tình thiếu mã nhân viên nhưng có branchCode
          'Họ và tên': 'Nhân viên không mã',
          Email: 'nomap@example.com',
          branchCode: 'CN-HN',
          departmentCode: 'PB-IT',
        },
      ]

      const req = new NextRequest('http://localhost:3000/api/employees/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rows),
      })
      const res = await importEmployeesHandler(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      // Dòng trống bị bỏ qua, dòng thiếu mã bị báo lỗi "Thiếu mã nhân viên" chứ không bị nhận nhầm branchCode
      expect(json.data.importedCount).toBe(0)
      expect(json.data.errors).toHaveLength(1)
      expect(json.data.errors[0].error).toContain('Thiếu mã nhân viên')
    })

    it('chuẩn hoá số điện thoại 9 số và hạ vai trò HR_MANAGER về EMPLOYEE cho BRANCH_ADMIN', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr_ba', role: 'BRANCH_ADMIN', employee: { id: 'emp_ba', branchId: 'br_hn' } },
      })
      mockPrisma.user.findMany.mockResolvedValue([])
      mockPrisma.employee.findMany.mockResolvedValue([])
      mockPrisma.user.create.mockResolvedValue({ id: 'usr_created' })
      mockPrisma.employee.create.mockResolvedValue({ id: 'emp_created' })

      const rows = [
        {
          'Mã nhân viên': 'NV_PHONE',
          'Họ và tên': 'Nguyễn Văn Phone',
          Email: 'phone.test@example.com',
          'Số điện thoại': 901234567, // Dạng number bị mất số 0
          'Mã chi nhánh': 'CN-HN',
          'Mã phòng ban': 'PB-IT',
          'Vai trò': 'HR_MANAGER', // BRANCH_ADMIN không được tạo HR_MANAGER
        },
      ]

      const req = new NextRequest('http://localhost:3000/api/employees/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rows),
      })
      const res = await importEmployeesHandler(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.data.importedCount).toBe(1)
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: 'EMPLOYEE', // Bị hạ về EMPLOYEE
          }),
        })
      )
      expect(mockPrisma.employee.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            phoneNumber: '0901234567', // Được chuẩn hoá thành 0901234567
          }),
        })
      )
    })

    it('hỗ trợ import qua file Excel buffer với nhiều sheet (tự nhận diện sheet nhân viên)', async () => {
      mockSession.mockResolvedValue({
        user: { id: 'usr_hr', role: 'HR_MANAGER' },
      })
      mockPrisma.user.findMany.mockResolvedValue([])
      mockPrisma.employee.findMany.mockResolvedValue([])
      mockPrisma.user.create.mockResolvedValue({ id: 'usr_excel_1' })
      mockPrisma.employee.create.mockResolvedValue({ id: 'emp_excel_1' })

      // Tạo workbook với 2 sheet: Sheet 1 là 'Hướng dẫn', Sheet 2 là 'Danh sách nhân viên'
      const wb = XLSX.utils.book_new()
      const guideData = [['Cột', 'Mô tả'], ['Mã nhân viên', 'Bắt buộc']]
      const empData = [
        ['Mã nhân viên (*)', 'Họ và tên (*)', 'Email (*)', 'Số điện thoại', 'Chức vụ', 'Mã chi nhánh (*)', 'Mã phòng ban (*)'],
        ['NV_FILE_1', 'Phạm Thị File', 'file.pham@example.com', '0933333333', 'Tester', 'CN-HN', 'PB-IT'],
      ]

      const guideSheet = XLSX.utils.aoa_to_sheet(guideData)
      const empSheet = XLSX.utils.aoa_to_sheet(empData)

      // Cố tình đưa Hướng dẫn lên đầu
      XLSX.utils.book_append_sheet(wb, guideSheet, 'Hướng dẫn điền')
      XLSX.utils.book_append_sheet(wb, empSheet, 'Danh sách nhân viên')

      const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

      const formData = new FormData()
      formData.append('file', new File([excelBuffer], 'danh_sach.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }))

      const req = new NextRequest('http://localhost:3000/api/employees/import', {
        method: 'POST',
        body: formData,
      })
      const res = await importEmployeesHandler(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.data.importedCount).toBe(1)
      expect(mockPrisma.employee.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            employeeCode: 'NV_FILE_1',
            fullName: 'Phạm Thị File',
          }),
        })
      )
    })
  })
})
