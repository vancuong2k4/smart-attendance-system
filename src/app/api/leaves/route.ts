import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { parseDateOnly, isValidDateString } from '@/lib/attendance'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { createLeaveRequestSchema } from '@/lib/validations'
import { LeaveStatus, Prisma, UserRole } from '@prisma/client'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const leaveTypeId = searchParams.get('leaveTypeId')
    let employeeId = searchParams.get('employeeId')
    let branchId = searchParams.get('branchId')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const skip = (page - 1) * limit

    const where: Prisma.LeaveRequestWhereInput = {}

    // Phân quyền dữ liệu
    if (session.user.role === UserRole.EMPLOYEE) {
      // Nhân viên chỉ được xem đơn của chính mình
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
      // Branch Admin chỉ được xem nhân viên thuộc chi nhánh mình
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
      // HR_MANAGER hoặc SUPER_ADMIN
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

    // Lọc theo status
    if (status && Object.values(LeaveStatus).includes(status as LeaveStatus)) {
      where.status = status as LeaveStatus
    }

    // Lọc theo loại nghỉ
    if (leaveTypeId) {
      where.leaveTypeId = leaveTypeId
    }

    // Lọc theo date range
    if (from || to) {
      if (from) {
        if (!isValidDateString(from)) {
          return errorResponse(ErrorCodes.VALIDATION_ERROR, 'Tham số from không hợp lệ (YYYY-MM-DD)', 422)
        }
        where.startDate = { ...(where.startDate as any), gte: parseDateOnly(from) }
      }
      if (to) {
        if (!isValidDateString(to)) {
          return errorResponse(ErrorCodes.VALIDATION_ERROR, 'Tham số to không hợp lệ (YYYY-MM-DD)', 422)
        }
        where.endDate = { ...(where.endDate as any), lte: parseDateOnly(to) }
      }
    }

    const [total, leaves] = await Promise.all([
      prisma.leaveRequest.count({ where }),
      prisma.leaveRequest.findMany({
        where,
        include: {
          leaveType: {
            select: {
              id: true,
              code: true,
              name: true,
              isPaid: true,
              requireApproval: true,
            },
          },
          employee: {
            select: {
              id: true,
              fullName: true,
              employeeCode: true,
              position: true,
              annualLeaveBalance: true,
              sickLeaveBalance: true,
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
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: limit,
      }),
    ])

    // Lấy số dư phép của nhân viên hiện tại để hiển thị trên UI
    let userBalances = null
    const currentEmpId = session.user.employee?.id
    if (currentEmpId) {
      const currentEmp = await prisma.employee.findUnique({
        where: { id: currentEmpId },
        select: { annualLeaveBalance: true, sickLeaveBalance: true },
      })
      if (currentEmp) {
        userBalances = {
          annual: currentEmp.annualLeaveBalance,
          sick: currentEmp.sickLeaveBalance,
        }
      }
    }

    return successResponse({
      leaves,
      balances: userBalances,
      userRole: session.user.role,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error: any) {
    console.error('Error fetching leaves:', error)
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Đã xảy ra lỗi khi tải danh sách nghỉ phép',
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
        'Tài khoản chưa được liên kết với hồ sơ nhân viên để nộp đơn nghỉ',
        403
      )
    }

    const body = await req.json().catch(() => null)
    if (!body) {
      return errorResponse(ErrorCodes.VALIDATION_ERROR, 'Dữ liệu không hợp lệ', 400)
    }

    const parsed = createLeaveRequestSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        parsed.error.issues[0]?.message || 'Dữ liệu không hợp lệ',
        422,
        parsed.error.format()
      )
    }

    const { leaveTypeId, startDate, endDate, totalDays, reason, attachmentUrl } = parsed.data

    // 1. Kiểm tra LeaveType tồn tại (theo id hoặc code)
    const leaveType = await prisma.leaveType.findFirst({
      where: {
        OR: [{ id: leaveTypeId }, { code: leaveTypeId }],
      },
    })

    if (!leaveType) {
      return errorResponse(ErrorCodes.NOT_FOUND, 'Loại nghỉ phép không tồn tại', 404)
    }

    // 2. Kiểm tra số dư phép nếu loại nghỉ trừ phép năm (AL)
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        fullName: true,
        annualLeaveBalance: true,
        sickLeaveBalance: true,
      },
    })

    if (!employee) {
      return errorResponse(ErrorCodes.NOT_FOUND, 'Không tìm thấy hồ sơ nhân viên', 404)
    }

    if (leaveType.code === 'AL') {
      if (employee.annualLeaveBalance < totalDays) {
        return errorResponse(
          ErrorCodes.VALIDATION_ERROR,
          `Số dư ngày phép năm không đủ (còn ${employee.annualLeaveBalance} ngày, yêu cầu ${totalDays} ngày)`,
          400
        )
      }
    } else if (leaveType.code === 'SL') {
      if (employee.sickLeaveBalance < totalDays) {
        return errorResponse(
          ErrorCodes.VALIDATION_ERROR,
          `Số dư ngày phép ốm không đủ (còn ${employee.sickLeaveBalance} ngày, yêu cầu ${totalDays} ngày)`,
          400
        )
      }
    }

    // 3. Kiểm tra trùng lặp thời gian với các đơn đang PENDING hoặc APPROVED
    const startDateObj = parseDateOnly(startDate)
    const endDateObj = parseDateOnly(endDate)

    const overlappingLeave = await prisma.leaveRequest.findFirst({
      where: {
        employeeId,
        status: { in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
        startDate: { lte: endDateObj },
        endDate: { gte: startDateObj },
      },
    })

    if (overlappingLeave) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'Khoảng thời gian xin nghỉ bị trùng với một đơn khác đang chờ duyệt hoặc đã duyệt',
        400
      )
    }

    // 4. Tạo LeaveRequest
    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        employeeId,
        leaveTypeId: leaveType.id,
        startDate: startDateObj,
        endDate: endDateObj,
        totalDays,
        reason: reason || null,
        attachmentUrl: attachmentUrl || null,
        status: LeaveStatus.PENDING,
      },
      include: {
        leaveType: true,
        employee: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            annualLeaveBalance: true,
          },
        },
      },
    })

    return successResponse(leaveRequest, 201)
  } catch (error: any) {
    console.error('Error creating leave request:', error)
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Đã xảy ra lỗi khi nộp đơn xin nghỉ phép',
      500
    )
  }
}
