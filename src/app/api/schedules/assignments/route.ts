import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { shiftAssignSchema } from '@/lib/shift-validation'
import { UserRole, Prisma } from '@prisma/client'

/**
 * GET /api/schedules/assignments
 * Lấy danh sách phân ca làm việc của nhân viên theo khoảng thời gian và chi nhánh
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    const { searchParams } = new URL(req.url)
    const employeeId = searchParams.get('employeeId')
    const branchId = searchParams.get('branchId')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const month = searchParams.get('month') // YYYY-MM

    const where: Prisma.ShiftAssignmentWhereInput = {}

    // Phân quyền dữ liệu
    if (session.user.role === UserRole.EMPLOYEE) {
      const myEmpId = session.user.employee?.id
      if (!myEmpId) {
        return errorResponse(
          ErrorCodes.FORBIDDEN,
          'Tài khoản chưa được liên kết với nhân viên',
          403
        )
      }
      where.employeeId = myEmpId
    } else if (session.user.role === UserRole.BRANCH_ADMIN) {
      const userBranchId = session.user.employee?.branchId
      where.employee = { branchId: userBranchId }
      if (employeeId) {
        where.employeeId = employeeId
      }
    } else {
      // SUPER_ADMIN hoặc HR_MANAGER
      if (employeeId) where.employeeId = employeeId
      if (branchId) where.employee = { branchId }
    }

    // Lọc theo ngày
    if (from || to) {
      where.date = {}
      if (from) where.date.gte = new Date(`${from}T00:00:00.000Z`)
      if (to) where.date.lte = new Date(`${to}T23:59:59.999Z`)
    } else if (month) {
      const [year, m] = month.split('-').map(Number)
      const startDate = new Date(Date.UTC(year, m - 1, 1))
      const endDate = new Date(Date.UTC(year, m, 0, 23, 59, 59, 999))
      where.date = {
        gte: startDate,
        lte: endDate,
      }
    }

    const assignments = await prisma.shiftAssignment.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            avatarUrl: true,
            position: true,
            branch: {
              select: { id: true, name: true, code: true },
            },
            department: {
              select: { id: true, name: true },
            },
          },
        },
        schedule: {
          select: {
            id: true,
            name: true,
            startTime: true,
            endTime: true,
            lunchStart: true,
            lunchEnd: true,
            isDefault: true,
          },
        },
      },
      orderBy: [{ date: 'asc' }, { schedule: { startTime: 'asc' } }],
    })

    return successResponse(assignments)
  } catch (error: any) {
    console.error('Error fetching shift assignments:', error)
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Không thể tải danh sách phân ca',
      500
    )
  }
}

/**
 * POST /api/schedules/assignments
 * Phân ca hàng loạt cho danh sách nhân viên theo ngày
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    const isSuperAdmin = session.user.role === UserRole.SUPER_ADMIN
    const isBranchAdmin = session.user.role === UserRole.BRANCH_ADMIN

    if (!isSuperAdmin && !isBranchAdmin) {
      return errorResponse(
        ErrorCodes.FORBIDDEN,
        'Bạn không có quyền thực hiện phân ca cho nhân viên',
        403
      )
    }

    const body = await req.json().catch(() => null)
    if (!body) {
      return errorResponse(ErrorCodes.BAD_REQUEST, 'Dữ liệu không hợp lệ', 400)
    }

    const validation = shiftAssignSchema.safeParse(body)
    if (!validation.success) {
      const firstIssue = validation.error.issues?.[0] || validation.error.errors?.[0]
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        firstIssue?.message || 'Dữ liệu phân ca không hợp lệ',
        422,
        validation.error.issues || validation.error.errors
      )
    }

    const { employeeIds, scheduleId, dates, note } = validation.data

    // Kiểm tra ca làm việc tồn tại
    const schedule = await prisma.workSchedule.findUnique({
      where: { id: scheduleId },
    })

    if (!schedule) {
      return errorResponse(ErrorCodes.NOT_FOUND, 'Ca làm việc chỉ định không tồn tại', 404)
    }

    // Nếu là Branch Admin, kiểm tra ca làm việc có thuộc chi nhánh của mình không
    if (isBranchAdmin && session.user.employee?.branchId !== schedule.branchId) {
      return errorResponse(
        ErrorCodes.FORBIDDEN,
        'Quản trị viên chỉ được phân ca thuộc chi nhánh phụ trách',
        403
      )
    }

    // Thực hiện upsert phân ca cho từng (employeeId, date)
    const operations = []
    for (const empId of employeeIds) {
      for (const dateStr of dates) {
        const dateObj = new Date(`${dateStr}T00:00:00.000Z`)
        operations.push(
          prisma.shiftAssignment.upsert({
            where: {
              employeeId_date: {
                employeeId: empId,
                date: dateObj,
              },
            },
            create: {
              employeeId: empId,
              scheduleId,
              date: dateObj,
              note: note || null,
              assignedById: session.user.id,
            },
            update: {
              scheduleId,
              note: note || null,
              assignedById: session.user.id,
            },
          })
        )
      }
    }

    await prisma.$transaction(operations)

    return successResponse({
      totalAssigned: operations.length,
      employeesCount: employeeIds.length,
      datesCount: dates.length,
      scheduleName: schedule.name,
    }, 201)
  } catch (error: any) {
    console.error('Error assigning shifts:', error)
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Không thể thực hiện phân ca làm việc',
      500
    )
  }
}
