import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { parseDateOnly, isValidDateString, getVietnamDateString } from '@/lib/attendance'
import { combineDateAndTimeString, validateAdjustmentTimes } from '@/lib/attendance-adjustment'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { createAttendanceAdjustmentSchema } from '@/lib/validations'
import { AdjustmentStatus, AdjustmentType, Prisma, UserRole } from '@prisma/client'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const employeeId = searchParams.get('employeeId')
    const branchId = searchParams.get('branchId')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const skip = (page - 1) * limit

    const where: Prisma.AttendanceAdjustmentWhereInput = {}

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
    if (status && Object.values(AdjustmentStatus).includes(status as AdjustmentStatus)) {
      where.status = status as AdjustmentStatus
    }

    // Lọc theo type
    if (type && Object.values(AdjustmentType).includes(type as AdjustmentType)) {
      where.type = type as AdjustmentType
    }

    // Lọc theo date range
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

    const [total, adjustments] = await Promise.all([
      prisma.attendanceAdjustment.count({ where }),
      prisma.attendanceAdjustment.findMany({
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
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: limit,
      }),
    ])

    return successResponse({
      adjustments,
      userRole: session.user.role,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error: any) {
    console.error('Error fetching attendance adjustments:', error)
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Đã xảy ra lỗi khi tải danh sách giải trình bù công',
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
        'Tài khoản chưa được liên kết với hồ sơ nhân viên để nộp đơn giải trình',
        403
      )
    }

    const body = await req.json().catch(() => null)
    if (!body) {
      return errorResponse(ErrorCodes.VALIDATION_ERROR, 'Dữ liệu không hợp lệ', 400)
    }

    const parsed = createAttendanceAdjustmentSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        parsed.error.issues[0]?.message || 'Dữ liệu không hợp lệ',
        422,
        parsed.error.format()
      )
    }

    const { date: dateStr, type, requestedCheckIn: reqIn, requestedCheckOut: reqOut, reason, evidenceUrl } = parsed.data

    const todayStr = getVietnamDateString()
    if (dateStr > todayStr) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'Không thể nộp đơn giải trình bù công cho ngày trong tương lai',
        400
      )
    }

    const dateOnly = parseDateOnly(dateStr)

    // Kiểm tra xem đã có đơn PENDING cho ngày này chưa
    const existingPending = await prisma.attendanceAdjustment.findFirst({
      where: {
        employeeId,
        date: dateOnly,
        status: AdjustmentStatus.PENDING,
      },
    })

    if (existingPending) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'Bạn đã có một đơn giải trình đang chờ duyệt cho ngày này',
        400
      )
    }

    // Chuyển đổi giờ check-in / check-out đề xuất thành Date UTC
    let requestedCheckIn: Date | null = null
    if (reqIn && reqIn.trim()) {
      const trimmedIn = reqIn.trim()
      requestedCheckIn = trimmedIn.includes('T')
        ? new Date(trimmedIn)
        : combineDateAndTimeString(dateStr, trimmedIn)
    }

    let requestedCheckOut: Date | null = null
    if (reqOut && reqOut.trim()) {
      const trimmedOut = reqOut.trim()
      requestedCheckOut = trimmedOut.includes('T')
        ? new Date(trimmedOut)
        : combineDateAndTimeString(dateStr, trimmedOut)
    }

    const timeValidation = validateAdjustmentTimes(requestedCheckIn, requestedCheckOut)
    if (!timeValidation.valid) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        timeValidation.error || 'Thời gian đề xuất không hợp lệ',
        400
      )
    }

    const adjustment = await prisma.attendanceAdjustment.create({
      data: {
        employeeId,
        date: dateOnly,
        type,
        requestedCheckIn,
        requestedCheckOut,
        reason: reason.trim(),
        evidenceUrl: evidenceUrl?.trim() || null,
        status: AdjustmentStatus.PENDING,
      },
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            branchId: true,
          },
        },
      },
    })

    return successResponse(adjustment, 201)
  } catch (error: any) {
    console.error('Error creating attendance adjustment:', error)
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Đã xảy ra lỗi khi tạo đơn giải trình bù công',
      500
    )
  }
}
