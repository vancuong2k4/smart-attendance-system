import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { canManageEmployees } from '@/lib/rbac'
import { createEmployeeSchema } from '@/lib/validations'
import { Prisma, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    if (!canManageEmployees(session.user.role)) {
      return errorResponse(ErrorCodes.FORBIDDEN, 'Bạn không có quyền truy cập danh sách nhân viên', 403)
    }

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const skip = (page - 1) * limit

    let branchId = searchParams.get('branchId')
    const departmentId = searchParams.get('departmentId')
    const status = searchParams.get('status')
    const search = searchParams.get('search')?.trim()

    // Phân quyền chi nhánh
    if (session.user.role === UserRole.BRANCH_ADMIN) {
      const userBranchId = session.user.employee?.branchId
      if (!userBranchId) {
        return errorResponse(
          ErrorCodes.FORBIDDEN,
          'Tài khoản quản trị chi nhánh chưa được gắn với chi nhánh nào',
          403
        )
      }
      branchId = userBranchId
    }

    const where: Prisma.EmployeeWhereInput = {}

    if (branchId) {
      where.branchId = branchId
    }

    if (departmentId) {
      where.departmentId = departmentId
    }

    // Lọc theo status: ACTIVE, INACTIVE, PROBATION
    if (status === 'ACTIVE') {
      where.user = { ...(where.user as any), isActive: true }
      where.employmentType = { not: 'PROBATION' }
    } else if (status === 'PROBATION') {
      where.user = { ...(where.user as any), isActive: true }
      where.employmentType = 'PROBATION'
    } else if (status === 'INACTIVE') {
      where.user = { ...(where.user as any), isActive: false }
    }

    // Tìm kiếm theo từ khóa (tên, mã nhân viên, email, số điện thoại)
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { employeeCode: { contains: search, mode: 'insensitive' } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { phoneNumber: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Thống kê nhanh trong phạm vi chi nhánh (hoặc toàn công ty)
    const baseStatsWhere: Prisma.EmployeeWhereInput = {}
    if (branchId) {
      baseStatsWhere.branchId = branchId
    }

    const [total, employees, totalInScope, activeCount, probationCount, inactiveCount] =
      await Promise.all([
        prisma.employee.count({ where }),
        prisma.employee.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                email: true,
                role: true,
                isActive: true,
                lastLoginAt: true,
                createdAt: true,
              },
            },
            branch: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            department: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
          orderBy: [{ createdAt: 'desc' }],
          skip,
          take: limit,
        }),
        prisma.employee.count({ where: baseStatsWhere }),
        prisma.employee.count({
          where: {
            ...baseStatsWhere,
            user: { isActive: true },
            employmentType: { not: 'PROBATION' },
          },
        }),
        prisma.employee.count({
          where: {
            ...baseStatsWhere,
            user: { isActive: true },
            employmentType: 'PROBATION',
          },
        }),
        prisma.employee.count({
          where: {
            ...baseStatsWhere,
            user: { isActive: false },
          },
        }),
      ])

    return successResponse({
      employees,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        total: totalInScope,
        active: activeCount,
        probation: probationCount,
        inactive: inactiveCount,
      },
    })
  } catch (error: any) {
    console.error('Error fetching employees:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Không thể tải danh sách nhân viên', 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    if (!canManageEmployees(session.user.role)) {
      return errorResponse(ErrorCodes.FORBIDDEN, 'Bạn không có quyền tạo nhân viên', 403)
    }

    let body: any
    try {
      body = await req.json()
    } catch {
      return errorResponse(ErrorCodes.VALIDATION_ERROR, 'Dữ liệu JSON không hợp lệ', 400)
    }

    const parsed = createEmployeeSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        parsed.error.issues[0]?.message || 'Dữ liệu không hợp lệ',
        422,
        parsed.error.issues
      )
    }

    const data = parsed.data

    // Nếu là Branch Admin, kiểm tra xem có tạo cho đúng chi nhánh của mình không
    if (session.user.role === UserRole.BRANCH_ADMIN) {
      const userBranchId = session.user.employee?.branchId
      if (!userBranchId || userBranchId !== data.branchId) {
        return errorResponse(
          ErrorCodes.FORBIDDEN,
          'Bạn chỉ có quyền tạo nhân viên trong chi nhánh của mình',
          403
        )
      }
      // Branch Admin không thể tự tạo SUPER_ADMIN hoặc HR_MANAGER
      if (data.role === UserRole.SUPER_ADMIN || data.role === UserRole.HR_MANAGER) {
        return errorResponse(
          ErrorCodes.FORBIDDEN,
          'Bạn không có quyền gán vai trò Quản trị viên cấp cao hoặc Quản lý nhân sự',
          403
        )
      }
    }

    const emailClean = data.email.toLowerCase().trim()
    const employeeCodeClean = data.employeeCode.trim()

    // Kiểm tra trùng lặp email
    const existingUser = await prisma.user.findUnique({
      where: { email: emailClean },
    })
    if (existingUser) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'Email đã tồn tại trong hệ thống',
        409
      )
    }

    // Kiểm tra trùng lặp mã nhân viên
    const existingEmp = await prisma.employee.findUnique({
      where: { employeeCode: employeeCodeClean },
    })
    if (existingEmp) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'Mã nhân viên đã tồn tại trong hệ thống',
        409
      )
    }

    // Kiểm tra chi nhánh và phòng ban có tồn tại
    const [branch, department] = await Promise.all([
      prisma.branch.findUnique({ where: { id: data.branchId } }),
      prisma.department.findUnique({ where: { id: data.departmentId } }),
    ])

    if (!branch) {
      return errorResponse(ErrorCodes.NOT_FOUND, 'Không tìm thấy chi nhánh đã chọn', 404)
    }
    if (!department) {
      return errorResponse(ErrorCodes.NOT_FOUND, 'Không tìm thấy phòng ban đã chọn', 404)
    }
    if (department.branchId !== branch.id) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'Phòng ban đã chọn không thuộc chi nhánh chỉ định',
        422
      )
    }

    // Mật khẩu mặc định nếu không truyền
    const password = data.password && data.password.trim() ? data.password.trim() : 'Nv@123456'
    const passwordHash = await bcrypt.hash(password, 10)

    const newEmployee = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: emailClean,
          passwordHash,
          role: data.role || UserRole.EMPLOYEE,
          isActive: true,
        },
      })

      const emp = await tx.employee.create({
        data: {
          userId: user.id,
          employeeCode: employeeCodeClean,
          fullName: data.fullName.trim(),
          branchId: data.branchId,
          departmentId: data.departmentId,
          position: data.position ? data.position.trim() : null,
          phoneNumber: data.phoneNumber ? data.phoneNumber.trim() : null,
          address: data.address ? data.address.trim() : null,
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
          gender: data.gender || null,
          startDate: data.startDate ? new Date(data.startDate) : new Date(),
          employmentType: data.employmentType || 'FULL_TIME',
          annualLeaveBalance: 12,
          sickLeaveBalance: 10,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              isActive: true,
            },
          },
          branch: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          department: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      })

      return emp
    })

    return successResponse(newEmployee, 201)
  } catch (error: any) {
    console.error('Error creating employee:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Không thể tạo nhân viên mới', 500)
  }
}
