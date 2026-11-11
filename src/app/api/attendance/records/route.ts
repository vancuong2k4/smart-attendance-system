import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { parseDateOnly, isValidDateString } from '@/lib/attendance'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { AttendanceStatus, Prisma, UserRole } from '@prisma/client'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    const allowedRoles: UserRole[] = [
      UserRole.SUPER_ADMIN,
      UserRole.BRANCH_ADMIN,
      UserRole.HR_MANAGER,
    ]
    if (!allowedRoles.includes(session.user.role)) {
      return errorResponse(ErrorCodes.FORBIDDEN, 'Bạn không có quyền truy cập dữ liệu này', 403)
    }

    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    let branchId = searchParams.get('branchId')
    const departmentId = searchParams.get('departmentId')
    const status = searchParams.get('status')
    const isLate = searchParams.get('isLate')
    const isEarlyLeave = searchParams.get('isEarlyLeave')
    const search = searchParams.get('search')?.trim()
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const skip = (page - 1) * limit

    // Branch Admin chỉ được xem nhân viên chi nhánh mình
    if (session.user.role === UserRole.BRANCH_ADMIN) {
      branchId = session.user.employee?.branchId || null
      if (!branchId) {
        return errorResponse(
          ErrorCodes.FORBIDDEN,
          'Tài khoản quản trị chi nhánh chưa được gắn với chi nhánh nào',
          403
        )
      }
    }

    const where: Prisma.AttendanceRecordWhereInput = {}

    // Lọc theo date hoặc from/to
    if (date) {
      if (!isValidDateString(date)) {
        return errorResponse(ErrorCodes.VALIDATION_ERROR, 'Tham số date không hợp lệ (YYYY-MM-DD)', 422)
      }
      where.date = parseDateOnly(date)
    } else if (from || to) {
      where.date = {}
      if (from) {
        if (!isValidDateString(from)) {
          return errorResponse(ErrorCodes.VALIDATION_ERROR, 'Tham số from không hợp lệ (YYYY-MM-DD)', 422)
        }
        where.date.gte = parseDateOnly(from)
      }
      if (to) {
        if (!isValidDateString(to)) {
          return errorResponse(ErrorCodes.VALIDATION_ERROR, 'Tham số to không hợp lệ (YYYY-MM-DD)', 422)
        }
        where.date.lte = parseDateOnly(to)
      }
    }

    // Lọc status
    if (status && Object.values(AttendanceStatus).includes(status as AttendanceStatus)) {
      where.status = status as AttendanceStatus
    }

    // Lọc isLate
    if (isLate === 'true') {
      where.isLate = true
    } else if (isLate === 'false') {
      where.isLate = false
    }

    // Lọc isEarlyLeave
    if (isEarlyLeave === 'true') {
      where.isEarlyLeave = true
    } else if (isEarlyLeave === 'false') {
      where.isEarlyLeave = false
    }

    // Điều kiện liên quan tới employee (branch, department, search)
    const employeeConditions: Prisma.EmployeeWhereInput = {}

    if (branchId) {
      employeeConditions.branchId = branchId
    }

    if (departmentId) {
      employeeConditions.departmentId = departmentId
    }

    if (search) {
      employeeConditions.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { employeeCode: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (Object.keys(employeeConditions).length > 0) {
      where.employee = employeeConditions
    }

    const [total, records] = await Promise.all([
      prisma.attendanceRecord.count({ where }),
      prisma.attendanceRecord.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              fullName: true,
              employeeCode: true,
              position: true,
              avatarUrl: true,
              department: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
              branch: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  latitude: true,
                  longitude: true,
                  gpsRadius: true,
                },
              },
            },
          },
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
    ])

    return successResponse({
      records,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error: any) {
    console.error('Error in attendance records API:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Đã xảy ra lỗi khi tải danh sách chấm công', 500)
  }
}
