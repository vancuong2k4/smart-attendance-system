import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { parseDateOnly, isValidDateString } from '@/lib/attendance'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { createOvertimeRequestSchema } from '@/lib/validations'
import { LeaveStatus, Prisma, UserRole } from '@prisma/client'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    let employeeId = searchParams.get('employeeId')
    let branchId = searchParams.get('branchId')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const skip = (page - 1) * limit

    const where: Prisma.OvertimeRequestWhereInput = {}

    // Phân quyền dữ liệu
    if (session.user.role === UserRole.EMPLOYEE) {
      const currentEmpId = session.user.employee?.id
      if (!currentEmpId) {
        return errorResponse(
          ErrorCodes.FORBIDDEN,
          'Tài khoản chưa được liên kết với hồ sơ nhân viên',
          403
        )
      }
      where.employeeId = currentEmpId
    } else if (session.user.role === UserRole.BRANCH_ADMIN) {
      const userBranchId = session.user.employee?.branchId
      if (!userBranchId) {
        return errorResponse(
          ErrorCodes.FORBIDDEN,
          'Tài khoản quản trị chưa được gán chi nhánh',
          403
        )
      }
      where.employee = { branchId: userBranchId }
      if (employeeId) {
        where.employeeId = employeeId
      }
    } else {
      const employeeConditions: Prisma.EmployeeWhereInput = {}
      if (branchId) {
        employeeConditions.branchId = branchId
      }
      if (employeeId) {
        where.employeeId = employeeId
      }
      if (Object.keys(employeeConditions).length > 0) {
        where.employee = employeeConditions
      }
    }

    if (status && Object.values(LeaveStatus).includes(status as LeaveStatus)) {
      where.status = status as LeaveStatus
    }

    if (from || to) {
      if (from) {
        if (!isValidDateString(from)) {
          return errorResponse(ErrorCodes.VALIDATION_ERROR, 'Tham số from không hợp lệ (YYYY-MM-DD)', 422)
        }
        where.date = { ...(where.date as any), gte: parseDateOnly(from) }
      }
      if (to) {
        if (!isValidDateString(to)) {
          return errorResponse(ErrorCodes.VALIDATION_ERROR, 'Tham số to không hợp lệ (YYYY-MM-DD)', 422)
        }
        where.date = { ...(where.date as any), lte: parseDateOnly(to) }
      }
    }

    const [total, requests] = await Promise.all([
      prisma.overtimeRequest.count({ where }),
      prisma.overtimeRequest.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              fullName: true,
              employeeCode: true,
              position: true,
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
          },
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
    ])

    return successResponse({
      requests,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error: any) {
    console.error('Error fetching overtime requests:', error)
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Đã xảy ra lỗi khi tải danh sách làm thêm giờ (OT)',
      500
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    const employeeId = session.user.employee?.id
    if (!employeeId) {
      return errorResponse(
        ErrorCodes.FORBIDDEN,
        'Tài khoản chưa được liên kết với hồ sơ nhân viên để đăng ký làm thêm giờ',
        403
      )
    }

    const body = await req.json().catch(() => null)
    if (!body) {
      return errorResponse(ErrorCodes.VALIDATION_ERROR, 'Dữ liệu không hợp lệ', 400)
    }

    const parsed = createOvertimeRequestSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        parsed.error.issues[0]?.message || 'Dữ liệu không hợp lệ',
        422,
        parsed.error.format()
      )
    }

    const { date, startTime, endTime, hours, reason } = parsed.data

    const otRequest = await prisma.overtimeRequest.create({
      data: {
        employeeId,
        date: parseDateOnly(date),
        startTime,
        endTime,
        hours,
        reason: reason || null,
        status: LeaveStatus.PENDING,
      },
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
          },
        },
      },
    })

    return successResponse(otRequest, 201)
  } catch (error: any) {
    console.error('Error creating overtime request:', error)
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Đã xảy ra lỗi khi tạo yêu cầu làm thêm giờ',
      500
    )
  }
}
